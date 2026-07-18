import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { WorldBook, WorldBookEntry } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { ImportModuleJsonDto } from '../../common/dto/import-module-json.dto';
import {
  createAvailableName,
  invalidModuleFormat,
  limitText,
  optionalBoolean,
  optionalInteger,
  optionalNullableInteger,
  optionalRecord,
  optionalString,
  optionalStringArray,
  parseModuleJson,
  requiredString,
  requiredStringArray,
  type JsonRecord,
  type ModuleJsonImportWarning
} from '../../common/module-json-import';
import { PrismaService } from '../../prisma/prisma.service';
import type { WorldBookContext, WorldBookEntryContext } from '../../services/prompt-builder/types';
import { SettingsService } from '../settings/settings.service';
import { ContentLibraryService } from '../content-library/content-library.service';
import type { CurrentUser } from '../users/user.types';
import type { CreateWorldBookEntryDto } from './dto/create-world-book-entry.dto';
import type { CreateWorldBookDto } from './dto/create-world-book.dto';
import type { QueryWorldBooksDto } from './dto/query-world-books.dto';
import type { UpdateWorldBookEntryDto } from './dto/update-world-book-entry.dto';
import type { UpdateWorldBookDto } from './dto/update-world-book.dto';
import { WORLD_BOOK_ENTRY_INSERTION_ORDERS } from './world-books.constants';
import type {
  WorldBookEntryInsertionOrder,
  WorldBookEntryResponse,
  WorldBookListResponse,
  WorldBookResponse
} from './world-book.types';

type WorldBookEntryImportPreview = {
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords: string[];
  isEnabled: boolean;
  priority: number;
  insertionOrder: WorldBookEntryInsertionOrder;
  tokenBudget: number | null;
  caseSensitive: boolean;
  metadata: Record<string, unknown> | null;
};

type WorldBookImportPreview = {
  name: string;
  description: string;
  characterIds: string[];
  isEnabled: boolean;
  scanDepth: number;
  tokenBudget: number;
  metadata: Record<string, unknown> | null;
  entries: WorldBookEntryImportPreview[];
  warnings: ModuleJsonImportWarning[];
  nameConflict: boolean;
  suggestedName: string | null;
};

type WorldBookImportResponse = {
  imported: boolean;
  preview: WorldBookImportPreview;
  worldBook: WorldBookResponse | null;
};

type NormalizedWorldBookImport = Omit<WorldBookImportPreview, 'nameConflict' | 'suggestedName'>;

/** 世界书 + 其条目（include 后的形态）。 */
type WorldBookWithEntries = WorldBook & {
  entries: WorldBookEntry[];
  characterLinks: Array<{ characterId: string }>;
};

/** 条目 + 其世界书（include 后的形态）。 */
type WorldBookEntryWithBook = WorldBookEntry & {
  worldBook: WorldBook;
};

/**
 * 世界书服务：世界书及其条目的 CRUD，并提供 prompt 构建所需的世界书上下文。
 *
 * 世界书可绑定多个角色（characterIds）或全局（无角色关联，所有角色共享）。
 * 所有查询按 userId 隔离；删除世界书时级联软删除其条目。
 */
@Injectable()
export class WorldBooksService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ContentLibraryService)
    private readonly contentLibraryService: ContentLibraryService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 分页查询当前用户的世界书（含条目）。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/角色/启用过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(currentUser: CurrentUser, query: QueryWorldBooksDto): Promise<WorldBookListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const access = await this.contentLibraryService.resolveAccess(currentUser, query.scope);
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    // 构建查询条件：限定当前用户 + 未软删除
    const where = {
      userId: access.owner.id,
      ...(query.scope === 'library' ? { isShared: true } : {}),
      deletedAt: null,
      ...(showSensitiveContent ? {} : { isSensitive: false }),
      // characterId/isEnabled 未传时不加条件，传了则按关联角色过滤
      ...(query.characterId === undefined
        ? {}
        : { characterLinks: { some: { characterId: query.characterId } } }),
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      // search 关键字：匹配 name/description 任一包含
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }]
          }
        : {})
    };

    // 事务内并行：查当前页（含条目，按优先级倒序）+ 统计总数
    const [items, total] = await this.prisma.$transaction([
      this.prisma.worldBook.findMany({
        where,
        include: {
          characterLinks: {
            select: { characterId: true },
            orderBy: { createdAt: 'asc' }
          },
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.worldBook.count({ where })
    ]);

    return {
      items: items.map((worldBook) =>
        this.toWorldBookResponse(worldBook, currentUser, access.ownerName)
      ),
      total,
      page,
      pageSize
    };
  }

  /**
   * 取角色的世界书上下文（供 prompt 构建用）。
   *
   * 查询条件：当前用户 + 未删除 + （无角色关联的全局世界书或关联当前角色）。
   * 即角色可用全局世界书 + 自己专属的世界书。
   *
   * @param currentUser 当前登录用户。
   * @param characterId 角色 ID；为 null 时只取全局世界书。
   * @returns 世界书上下文数组。
   */
  async listPromptContexts(
    currentUser: CurrentUser,
    characterId: string | null
  ): Promise<WorldBookContext[]> {
    const worldBooks = await this.prisma.worldBook.findMany({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false }),
        OR: [
          { characterLinks: { none: {} } },
          ...(characterId ? [{ characterLinks: { some: { characterId } } }] : [])
        ]
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return worldBooks.map((worldBook) => this.toPromptContext(worldBook));
  }

  /**
   * 创建世界书：校验全部角色归属（若指定）+ 创建关联。
   * @param currentUser 当前登录用户。
   * @param dto 创建入参。
   * @returns 创建后的世界书响应（含条目）。
   * @throws BadRequestException 指定的角色不存在或不属于该用户。
   */
  async create(currentUser: CurrentUser, dto: CreateWorldBookDto): Promise<WorldBookResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    const characterIds = await this.resolveCharacterIds(currentUser, dto.characterIds ?? []);
    const worldBook = await this.prisma.worldBook.create({
      data: {
        userId: currentUser.id,
        name: dto.name,
        description: dto.description ?? '',
        isEnabled: dto.isEnabled ?? true,
        isSensitive: dto.isSensitive ?? false,
        isShared: dto.isShared ?? false,
        scanDepth: dto.scanDepth ?? 6,
        tokenBudget: dto.tokenBudget ?? 1000,
        metadataJson: this.stringifyNullable(dto.metadata),
        characterLinks: {
          create: characterIds.map((characterId) => ({ characterId }))
        }
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: true
      }
    });

    return this.toWorldBookResponse(worldBook, currentUser);
  }

  /**
   * 导入世界书 JSON：commit=false 只返回预览，commit=true 创建世界书和全部条目。
   * @param currentUser 当前登录用户。
   * @param dto 导入入参，含 rawJson、commit 和同名处理策略。
   * @returns WorldBookImportResponse，正式导入时包含新建世界书。
   * @throws BadRequestException JSON 非法、格式不符、角色不存在或含敏感字段时抛 400。
   * @throws ConflictException 同名冲突且策略为 reject 时抛 409。
   */
  async importJson(
    currentUser: CurrentUser,
    dto: ImportModuleJsonDto
  ): Promise<WorldBookImportResponse> {
    const parsed = parseModuleJson(dto.rawJson, 'tavern-lite.world-book.v1');
    const normalized = await this.normalizeWorldBookImport(currentUser, parsed);
    const existingNames = await this.loadExistingNames(currentUser);
    const nameConflict = existingNames.has(normalized.name);
    const suggestedName = nameConflict ? createAvailableName(normalized.name, existingNames) : null;
    const preview: WorldBookImportPreview = {
      ...normalized,
      nameConflict,
      suggestedName
    };

    if (!dto.commit) {
      return {
        imported: false,
        preview,
        worldBook: null
      };
    }

    if (nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: ERROR_CODES.MODULE_IMPORT_NAME_EXISTS,
        message: 'World book name already exists.',
        details: {
          suggestedName
        }
      });
    }

    const name = nameConflict && suggestedName ? suggestedName : normalized.name;
    const worldBook = await this.prisma.$transaction(async (tx) => {
      const created = await tx.worldBook.create({
        data: {
          userId: currentUser.id,
          name,
          description: normalized.description,
          isEnabled: normalized.isEnabled,
          isSensitive: false,
          isShared: false,
          scanDepth: normalized.scanDepth,
          tokenBudget: normalized.tokenBudget,
          metadataJson: this.stringifyNullable(normalized.metadata)
        }
      });

      if (normalized.entries.length > 0) {
        await tx.worldBookEntry.createMany({
          data: normalized.entries.map((entry) => ({
            worldBookId: created.id,
            title: entry.title,
            content: entry.content,
            keywordsJson: JSON.stringify(entry.keywords),
            secondaryKeywordsJson: this.stringifyNullable(entry.secondaryKeywords),
            isEnabled: entry.isEnabled,
            priority: entry.priority,
            position: entry.insertionOrder,
            tokenBudget: entry.tokenBudget,
            caseSensitive: entry.caseSensitive,
            metadataJson: this.stringifyNullable(entry.metadata)
          }))
        });
      }

      return tx.worldBook.findFirstOrThrow({
        where: {
          id: created.id
        },
        include: {
          characterLinks: {
            select: { characterId: true },
            orderBy: { createdAt: 'asc' }
          },
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
          }
        }
      });
    });

    return {
      imported: true,
      preview: {
        ...preview,
        name
      },
      worldBook: this.toWorldBookResponse(worldBook, currentUser)
    };
  }

  /** 返回可直接用于世界书导入的模板。 */
  getImportTemplate() {
    return {
      fileName: 'tavern-lite-world-book-template.json',
      template: {
        formatVersion: 'tavern-lite.world-book.v1',
        name: '示例世界书',
        description: '描述这本世界书适用的角色、场景或背景设定。',
        characterIds: [],
        isEnabled: false,
        scanDepth: 6,
        tokenBudget: 1000,
        metadata: {},
        entries: [
          {
            title: '示例条目',
            content: '关键词命中后注入 Prompt 的设定内容。',
            keywords: ['示例关键词'],
            secondaryKeywords: [],
            isEnabled: true,
            priority: 0,
            insertionOrder: 'before_history',
            tokenBudget: null,
            caseSensitive: false,
            metadata: {}
          }
        ]
      }
    };
  }

  /**
   * 获取单个世界书（含条目）。
   * @param currentUser 当前登录用户。
   * @param id 世界书 ID。
   * @returns 世界书响应（含条目）。
   * @throws NotFoundException 世界书不存在或不属于该用户。
   */
  async getById(currentUser: CurrentUser, id: string): Promise<WorldBookResponse> {
    const worldBook = await this.findVisibleActiveWorldBook(currentUser, id);
    const owner =
      worldBook.userId === currentUser.id ? null : await this.contentLibraryService.getOwner();
    return this.toWorldBookResponse(worldBook, currentUser, owner?.displayName ?? null);
  }

  async fork(
    currentUser: CurrentUser,
    id: string,
    targetCharacterId?: string
  ): Promise<WorldBookResponse> {
    const source = await this.findLibraryWorldBook(currentUser, id);
    if (source.characterLinks.length > 0 && !targetCharacterId) {
      throw new BadRequestException({
        code: ERROR_CODES.CONTENT_LIBRARY_WORLD_BOOK_TARGET_REQUIRED,
        message: 'A member-owned target character is required for this world book.'
      });
    }
    const characterIds =
      source.characterLinks.length > 0
        ? await this.resolveCharacterIds(currentUser, [targetCharacterId!])
        : [];
    const names = await this.loadExistingNames(currentUser);
    const worldBook = await this.prisma.$transaction(async (tx) => {
      const created = await tx.worldBook.create({
        data: {
          userId: currentUser.id,
          name: createAvailableName(source.name, names),
          description: source.description,
          isEnabled: source.isEnabled,
          isSensitive: source.isSensitive,
          isShared: false,
          scanDepth: source.scanDepth,
          tokenBudget: source.tokenBudget,
          metadataJson: source.metadataJson,
          characterLinks: {
            create: characterIds.map((characterId) => ({ characterId }))
          }
        }
      });
      if (source.entries.length > 0) {
        await tx.worldBookEntry.createMany({
          data: source.entries.map((entry) => ({
            worldBookId: created.id,
            title: entry.title,
            content: entry.content,
            keywordsJson: entry.keywordsJson,
            secondaryKeywordsJson: entry.secondaryKeywordsJson,
            isEnabled: entry.isEnabled,
            priority: entry.priority,
            position: entry.position,
            tokenBudget: entry.tokenBudget,
            caseSensitive: entry.caseSensitive,
            metadataJson: entry.metadataJson
          }))
        });
      }
      return tx.worldBook.findFirstOrThrow({
        where: { id: created.id },
        include: {
          characterLinks: {
            select: { characterId: true },
            orderBy: { createdAt: 'asc' }
          },
          entries: {
            where: { deletedAt: null },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
          }
        }
      });
    });
    return this.toWorldBookResponse(worldBook, currentUser);
  }

  /**
   * 更新世界书（部分更新）；characterIds 传入时校验全部角色归属。
   * @param currentUser 当前登录用户。
   * @param id 世界书 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的世界书响应（含条目）。
   * @throws BadRequestException 任一角色不存在或不属于该用户。
   * @throws NotFoundException 世界书不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateWorldBookDto
  ): Promise<WorldBookResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    // 先校验世界书存在且属于当前用户
    await this.findOwnedActiveWorldBook(currentUser, id);
    const characterIds =
      dto.characterIds === undefined
        ? undefined
        : await this.resolveCharacterIds(currentUser, dto.characterIds);

    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    const worldBook = await this.prisma.worldBook.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(characterIds === undefined
          ? {}
          : {
              characterLinks: {
                deleteMany: {},
                create: characterIds.map((characterId) => ({ characterId }))
              }
            }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
        ...(dto.isSensitive === undefined ? {} : { isSensitive: dto.isSensitive }),
        ...(dto.isShared === undefined ? {} : { isShared: dto.isShared }),
        ...(dto.scanDepth === undefined ? {} : { scanDepth: dto.scanDepth }),
        ...(dto.tokenBudget === undefined ? {} : { tokenBudget: dto.tokenBudget }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) })
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });

    return this.toWorldBookResponse(worldBook, currentUser);
  }

  /**
   * 删除世界书（级联软删除）：世界书 + 其所有条目一起软删除。
   * @param currentUser 当前登录用户。
   * @param id 世界书 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 世界书不存在或不属于该用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveWorldBook(currentUser, id);

    // 事务：世界书软删除 + 其条目全部软删除
    await this.prisma.$transaction([
      this.prisma.worldBook.update({
        where: { id },
        data: {
          isEnabled: false,
          deletedAt: new Date()
        }
      }),
      this.prisma.worldBookEntry.updateMany({
        where: {
          worldBookId: id,
          deletedAt: null
        },
        data: {
          isEnabled: false,
          deletedAt: new Date()
        }
      })
    ]);

    return {
      deleted: true,
      id
    };
  }

  /**
   * 创建条目：先校验世界书归属，再创建。
   * @param currentUser 当前登录用户。
   * @param worldBookId 世界书 ID。
   * @param dto 条目创建入参。
   * @returns 创建后的条目响应。
   * @throws NotFoundException 世界书不存在或不属于该用户。
   */
  async createEntry(
    currentUser: CurrentUser,
    worldBookId: string,
    dto: CreateWorldBookEntryDto
  ): Promise<WorldBookEntryResponse> {
    // 校验世界书存在且属于当前用户
    await this.findOwnedActiveWorldBook(currentUser, worldBookId);

    const entry = await this.prisma.worldBookEntry.create({
      data: {
        worldBookId,
        title: dto.title,
        content: dto.content,
        // 关键词序列化成 JSON 存储；position 字段存 insertionOrder
        keywordsJson: JSON.stringify(dto.keywords),
        secondaryKeywordsJson: this.stringifyNullable(dto.secondaryKeywords),
        isEnabled: dto.isEnabled ?? true,
        priority: dto.priority ?? 0,
        position: dto.insertionOrder ?? 'before_history',
        tokenBudget: dto.tokenBudget ?? null,
        caseSensitive: dto.caseSensitive ?? false,
        metadataJson: this.stringifyNullable(dto.metadata)
      }
    });

    return this.toEntryResponse(entry);
  }

  /**
   * 更新条目（部分更新）。
   * @param currentUser 当前登录用户。
   * @param id 条目 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的条目响应。
   * @throws NotFoundException 条目不存在或所属世界书不属于该用户。
   */
  async updateEntry(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateWorldBookEntryDto
  ): Promise<WorldBookEntryResponse> {
    // 先校验条目存在且属于当前用户（通过世界书关联校验）
    await this.findOwnedActiveEntry(currentUser, id);

    // 部分更新：仅写入 DTO 中实际传入的字段；keywords/insertionOrder 需转换存储格式
    const entry = await this.prisma.worldBookEntry.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(dto.keywords === undefined ? {} : { keywordsJson: JSON.stringify(dto.keywords) }),
        ...(dto.secondaryKeywords === undefined
          ? {}
          : { secondaryKeywordsJson: this.stringifyNullable(dto.secondaryKeywords) }),
        ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
        ...(dto.priority === undefined ? {} : { priority: dto.priority }),
        ...(dto.insertionOrder === undefined ? {} : { position: dto.insertionOrder }),
        ...(dto.tokenBudget === undefined ? {} : { tokenBudget: dto.tokenBudget }),
        ...(dto.caseSensitive === undefined ? {} : { caseSensitive: dto.caseSensitive }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) })
      }
    });

    return this.toEntryResponse(entry);
  }

  /**
   * 删除条目（软删除）。
   * @param currentUser 当前登录用户。
   * @param id 条目 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 条目不存在或所属世界书不属于该用户。
   */
  async removeEntry(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveEntry(currentUser, id);

    await this.prisma.worldBookEntry.update({
      where: { id },
      data: {
        isEnabled: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  /**
   * 归一化世界书导入 JSON。
   * @param currentUser 当前登录用户。
   * @param record 原始 JSON 对象。
   * @returns 可写入数据库的世界书导入数据。
   */
  private async normalizeWorldBookImport(
    _currentUser: CurrentUser,
    record: JsonRecord
  ): Promise<NormalizedWorldBookImport> {
    const warnings: ModuleJsonImportWarning[] = [];
    const name = limitText(requiredString(record, 'name', 'name'), 120, 'name', warnings);

    return {
      name,
      description: limitText(
        optionalString(record, 'description', 'description') ?? '',
        10000,
        'description',
        warnings
      ),
      characterIds: [],
      isEnabled: false,
      scanDepth: optionalInteger(record, 'scanDepth', 6, 'scanDepth'),
      tokenBudget: optionalInteger(record, 'tokenBudget', 1000, 'tokenBudget'),
      metadata: optionalRecord(record, 'metadata', 'metadata'),
      entries: this.normalizeWorldBookEntries(record.entries, warnings),
      warnings
    };
  }

  /**
   * 归一化世界书条目数组。
   * @param value 原始 entries 字段。
   * @param warnings 告警收集数组。
   * @returns 条目导入预览列表。
   */
  private normalizeWorldBookEntries(
    value: unknown,
    warnings: ModuleJsonImportWarning[]
  ): WorldBookEntryImportPreview[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw invalidModuleFormat('entries must be an array when present.');
    }

    return value.map((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw invalidModuleFormat(`entries[${index}] must be an object.`);
      }

      const record = item as JsonRecord;
      const keywords = requiredStringArray(record, 'keywords', `entries[${index}].keywords`);

      if (keywords.length === 0) {
        throw invalidModuleFormat(`entries[${index}].keywords must contain at least one string.`);
      }

      return {
        title: limitText(
          requiredString(record, 'title', `entries[${index}].title`),
          120,
          `entries[${index}].title`,
          warnings
        ),
        content: limitText(
          requiredString(record, 'content', `entries[${index}].content`),
          10000,
          `entries[${index}].content`,
          warnings
        ),
        keywords,
        secondaryKeywords: optionalStringArray(
          record,
          'secondaryKeywords',
          `entries[${index}].secondaryKeywords`
        ),
        isEnabled: optionalBoolean(record, 'isEnabled', true, `entries[${index}].isEnabled`),
        priority: optionalInteger(record, 'priority', 0, `entries[${index}].priority`),
        insertionOrder: this.normalizeInsertionOrder(
          record.insertionOrder,
          `entries[${index}].insertionOrder`,
          warnings
        ),
        tokenBudget: optionalNullableInteger(
          record,
          'tokenBudget',
          `entries[${index}].tokenBudget`
        ),
        caseSensitive: optionalBoolean(
          record,
          'caseSensitive',
          false,
          `entries[${index}].caseSensitive`
        ),
        metadata: optionalRecord(record, 'metadata', `entries[${index}].metadata`)
      };
    });
  }

  /**
   * 归一化导入条目的插入位置，兼容旧提示词里的 message 命名。
   * @param value 原始 insertionOrder。
   * @param path 字段路径。
   * @param warnings 告警收集数组。
   * @returns 世界书条目插入位置。
   */
  private normalizeInsertionOrder(
    value: unknown,
    path: string,
    warnings: ModuleJsonImportWarning[]
  ): WorldBookEntryInsertionOrder {
    if (value === undefined || value === null || value === '') {
      return 'before_history';
    }

    if (typeof value !== 'string') {
      throw invalidModuleFormat(`${path} must be a string when present.`);
    }

    if (value === 'before_current_user_message') {
      warnings.push({
        code: 'INSERTION_ORDER_ALIAS_NORMALIZED',
        field: path,
        message: 'before_current_user_message 已归一化为 before_current_user_input。'
      });
      return 'before_current_user_input';
    }

    if (value === 'after_current_user_message') {
      warnings.push({
        code: 'INSERTION_ORDER_ALIAS_NORMALIZED',
        field: path,
        message: 'after_current_user_message 已归一化为 after_current_user_input。'
      });
      return 'after_current_user_input';
    }

    if ((WORLD_BOOK_ENTRY_INSERTION_ORDERS as readonly string[]).includes(value)) {
      return value as WorldBookEntryInsertionOrder;
    }

    throw invalidModuleFormat(`${path} has unsupported insertion order: ${value}.`);
  }

  /**
   * 读取当前用户已有世界书名称集合。
   * @param currentUser 当前登录用户。
   * @returns 当前用户未删除世界书的名称集合。
   */
  private async loadExistingNames(currentUser: CurrentUser): Promise<Set<string>> {
    const items = await this.prisma.worldBook.findMany({
      where: {
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        name: true
      }
    });

    return new Set(items.map((item) => item.name));
  }

  /**
   * 查询世界书并校验所有权：限定 id + 当前用户 + 未删除（含条目）。
   * @param currentUser 当前登录用户。
   * @param id 世界书 ID。
   * @returns 校验通过的世界书记录（含条目）。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActiveWorldBook(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookWithEntries> {
    const worldBook = await this.prisma.worldBook.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!worldBook) {
      throw new NotFoundException({
        code: ERROR_CODES.WORLD_BOOK_NOT_FOUND,
        message: 'World book not found.'
      });
    }

    return worldBook;
  }

  private async findVisibleActiveWorldBook(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookWithEntries> {
    const owner = await this.contentLibraryService.getOwner();
    const worldBook = await this.prisma.worldBook.findFirst({
      where: {
        id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false }),
        OR: [{ userId: currentUser.id }, { userId: owner.id, isShared: true }]
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: {
          where: { deletedAt: null },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });
    if (!worldBook)
      throw new NotFoundException({
        code: ERROR_CODES.WORLD_BOOK_NOT_FOUND,
        message: 'World book not found.'
      });
    return worldBook;
  }

  private async findLibraryWorldBook(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookWithEntries> {
    const owner = await this.contentLibraryService.getOwner();
    const worldBook = await this.prisma.worldBook.findFirst({
      where: {
        id,
        userId: owner.id,
        isShared: true,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        entries: {
          where: { deletedAt: null },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });
    if (!worldBook)
      throw new NotFoundException({
        code: ERROR_CODES.CONTENT_LIBRARY_ITEM_NOT_FOUND,
        message: 'Shared world book not found.'
      });
    return worldBook;
  }

  /**
   * 查询条目并校验所有权：通过所属世界书的用户间接校验。
   * @param currentUser 当前登录用户。
   * @param id 条目 ID。
   * @returns 校验通过的条目记录（含世界书）。
   * @throws NotFoundException 条目不存在或所属世界书不属于该用户。
   */
  private async findOwnedActiveEntry(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookEntryWithBook> {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const entry = await this.prisma.worldBookEntry.findFirst({
      where: {
        id,
        deletedAt: null,
        // 通过 worldBook 关联校验：世界书必须属于当前用户
        worldBook: {
          userId: currentUser.id,
          deletedAt: null,
          ...(showSensitiveContent ? {} : { isSensitive: false })
        }
      },
      include: {
        worldBook: true
      }
    });

    if (!entry) {
      throw new NotFoundException({
        code: ERROR_CODES.WORLD_BOOK_ENTRY_NOT_FOUND,
        message: 'World book entry not found.'
      });
    }

    return entry;
  }

  /** 校验角色列表全部属于当前用户，并返回去重后的 ID。 */
  private async resolveCharacterIds(
    currentUser: CurrentUser,
    characterIds: string[]
  ): Promise<string[]> {
    const normalizedIds = [...new Set(characterIds.map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0) return [];

    const characters = await this.prisma.character.findMany({
      where: {
        id: { in: normalizedIds },
        userId: currentUser.id,
        deletedAt: null
      },
      select: { id: true }
    });
    const foundIds = new Set(characters.map((character) => character.id));
    if (normalizedIds.some((id) => !foundIds.has(id))) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_NOT_FOUND,
        message: 'Character not found.'
      });
    }

    return normalizedIds;
  }

  /**
   * 世界书记录 → 对外响应（含条目、解析 metadata、格式化时间）。
   * @param worldBook 世界书记录（含条目）。
   * @returns 世界书响应。
   */
  private toWorldBookResponse(
    worldBook: WorldBookWithEntries,
    currentUser: CurrentUser,
    ownerName: string | null = null
  ): WorldBookResponse {
    const isOwner = worldBook.userId === currentUser.id;
    return {
      id: worldBook.id,
      userId: worldBook.userId,
      characterIds: worldBook.characterLinks.map((link) => link.characterId),
      name: worldBook.name,
      description: worldBook.description,
      isEnabled: worldBook.isEnabled,
      isSensitive: worldBook.isSensitive,
      isShared: worldBook.isShared,
      isOwner,
      ownerName,
      canFork: !isOwner && worldBook.isShared,
      scanDepth: worldBook.scanDepth,
      tokenBudget: worldBook.tokenBudget,
      metadata: this.parseRecord(worldBook.metadataJson),
      entries: worldBook.entries.map((entry) => this.toEntryResponse(entry)),
      createdAt: worldBook.createdAt.toISOString(),
      updatedAt: worldBook.updatedAt.toISOString()
    };
  }

  /**
   * 世界书记录 → prompt 构建用的上下文（结构同响应但用 prompt-builder 的类型）。
   * @param worldBook 世界书记录（含条目）。
   * @returns 世界书上下文。
   */
  private toPromptContext(worldBook: WorldBookWithEntries): WorldBookContext {
    return {
      id: worldBook.id,
      userId: worldBook.userId,
      characterIds: worldBook.characterLinks.map((link) => link.characterId),
      name: worldBook.name,
      description: worldBook.description,
      isEnabled: worldBook.isEnabled,
      isSensitive: worldBook.isSensitive,
      scanDepth: worldBook.scanDepth,
      tokenBudget: worldBook.tokenBudget,
      metadata: this.parseRecord(worldBook.metadataJson),
      entries: worldBook.entries.map((entry) => this.toPromptEntryContext(entry))
    };
  }

  /**
   * 条目 → prompt 构建用的条目上下文。
   * @param entry 条目记录。
   * @returns 条目上下文。
   */
  private toPromptEntryContext(entry: WorldBookEntry): WorldBookEntryContext {
    return {
      id: entry.id,
      worldBookId: entry.worldBookId,
      title: entry.title,
      content: entry.content,
      keywords: this.parseStringArray(entry.keywordsJson),
      secondaryKeywords: this.parseStringArray(entry.secondaryKeywordsJson),
      isEnabled: entry.isEnabled,
      priority: entry.priority,
      position: this.toInsertionOrder(entry.position),
      tokenBudget: entry.tokenBudget,
      caseSensitive: entry.caseSensitive,
      metadata: this.parseRecord(entry.metadataJson)
    };
  }

  /**
   * 条目记录 → 对外响应（解析关键词数组、metadata、格式化时间）。
   * @param entry 条目记录。
   * @returns 条目响应。
   */
  private toEntryResponse(entry: WorldBookEntry): WorldBookEntryResponse {
    return {
      id: entry.id,
      worldBookId: entry.worldBookId,
      title: entry.title,
      content: entry.content,
      keywords: this.parseStringArray(entry.keywordsJson),
      secondaryKeywords: this.parseStringArray(entry.secondaryKeywordsJson),
      isEnabled: entry.isEnabled,
      priority: entry.priority,
      insertionOrder: this.toInsertionOrder(entry.position),
      tokenBudget: entry.tokenBudget,
      caseSensitive: entry.caseSensitive,
      metadata: this.parseRecord(entry.metadataJson),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    };
  }

  /**
   * 把 position 字段归一化为插入位置枚举；非法值回退 before_history。
   * @param value 原始 position 值。
   * @returns 合法的插入位置。
   */
  private toInsertionOrder(value: string): WorldBookEntryInsertionOrder {
    return WORLD_BOOK_ENTRY_INSERTION_ORDERS.includes(value as WorldBookEntryInsertionOrder)
      ? (value as WorldBookEntryInsertionOrder)
      : 'before_history';
  }

  /**
   * 把结构化数据序列化成 JSON 字符串；undefined/null 返回 null。
   * @param value 任意值。
   * @returns JSON 字符串，undefined/null 返回 null。
   */
  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  /**
   * 解析关键词 JSON 为字符串数组；为空/非数组/解析失败返回空数组。
   * @param value keywordsJson 字符串。
   * @returns 关键词数组。
   */
  private parseStringArray(value: string | null): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  /**
   * 解析 metadataJson 为对象；为空/非对象/解析失败返回 null。
   * @param value metadataJson 字符串。
   * @returns 解析后的对象，或 null。
   */
  private parseRecord(value: string | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
