import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { WorldBook, WorldBookEntry, WorldBookEntryRevision } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { canonicalJson, canonicalSha256 } from '../../common/canonical-json';
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
import type { SetManualWorldBookActivationDto } from './dto/set-manual-world-book-activation.dto';
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
  insertionOrder: WorldBookEntryInsertionOrder;
  tokenBudget: number | null;
  contentType: string;
  trustLevel: string;
  activationMode: string;
  matchMode: string;
  primaryLogic: string;
  secondaryLogic: string;
  excludeKeywords: string[];
  sameMessageOnly: boolean;
  scanSources: string[];
  userHistoryScanDepth: number;
  stickyTurns: number;
  continuationTurns: number;
  cooldownTurns: number;
  delayTurns: number;
  cooldownPolicy: string;
  generationPurposes: string[];
  budgetPriority: number;
  sortOrder: number;
  compactContent: string | null;
};

type WorldBookImportPreview = {
  name: string;
  description: string;
  characterIds: string[];
  personaIds: string[];
  conversationIds: string[];
  companionIds: string[];
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
  entries: Array<WorldBookEntry & { activeRevision: WorldBookEntryRevision | null }>;
  characterLinks: Array<{ characterId: string }>;
  personaLinks: Array<{ personaId: string }>;
  conversationLinks: Array<{ conversationId: string }>;
  companionLinks: Array<{ companionId: string }>;
};

/** 条目 + 其世界书（include 后的形态）。 */
type WorldBookEntryWithBook = WorldBookEntry & {
  worldBook: WorldBook;
  activeRevision: WorldBookEntryRevision | null;
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
      ...(access.isManaged
        ? { userId: { not: currentUser.id } }
        : access.owner
          ? { userId: access.owner.id }
          : {}),
      ...(query.scope === 'library' ? { isShared: true } : {}),
      deletedAt: null,
      ...(access.isManaged || showSensitiveContent ? {} : { isSensitive: false }),
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
          personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
          conversationLinks: {
            select: { conversationId: true },
            orderBy: { createdAt: 'asc' }
          },
          companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: { createdAt: 'asc' },
            include: { activeRevision: true }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.worldBook.count({ where })
    ]);
    const ownerNames = access.isManaged
      ? await this.contentLibraryService.getOwnerNameMap(items.map((item) => item.userId))
      : null;

    return {
      items: items.map((worldBook) =>
        this.toWorldBookResponse(
          worldBook,
          currentUser,
          ownerNames?.get(worldBook.userId) ?? access.ownerName
        )
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
    characterId: string | null,
    scope: {
      conversationId?: string | null;
      personaId?: string | null;
      companionId?: string | null;
    } = {}
  ): Promise<WorldBookContext[]> {
    const worldBooks = await this.prisma.worldBook.findMany({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false }),
        OR: [
          {
            AND: [
              { characterLinks: { none: {} } },
              { personaLinks: { none: {} } },
              { conversationLinks: { none: {} } },
              { companionLinks: { none: {} } }
            ]
          },
          ...(characterId ? [{ characterLinks: { some: { characterId } } }] : []),
          ...(scope.personaId ? [{ personaLinks: { some: { personaId: scope.personaId } } }] : []),
          ...(scope.conversationId
            ? [{ conversationLinks: { some: { conversationId: scope.conversationId } } }]
            : []),
          ...(scope.companionId
            ? [{ companionLinks: { some: { companionId: scope.companionId } } }]
            : [])
        ]
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
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
    const [characterIds, personaIds, conversationIds, companionIds] = await Promise.all([
      this.resolveCharacterIds(currentUser, dto.characterIds ?? []),
      this.resolvePersonaIds(currentUser, dto.personaIds ?? []),
      this.resolveConversationIds(currentUser, dto.conversationIds ?? []),
      this.resolveCompanionIds(currentUser, dto.companionIds ?? [])
    ]);
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
        },
        personaLinks: {
          create: personaIds.map((personaId) => ({ personaId }))
        },
        conversationLinks: {
          create: conversationIds.map((conversationId) => ({ conversationId }))
        },
        companionLinks: {
          create: companionIds.map((companionId) => ({ companionId }))
        }
      },
      include: {
        characterLinks: {
          select: { characterId: true },
          orderBy: { createdAt: 'asc' }
        },
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: { include: { activeRevision: true } }
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
    const parsed = parseModuleJson(dto.rawJson, 'tavern-lite.world-book.v2');
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
          metadataJson: this.stringifyNullable(normalized.metadata),
          characterLinks: {
            create: normalized.characterIds.map((characterId) => ({ characterId }))
          },
          personaLinks: { create: normalized.personaIds.map((personaId) => ({ personaId })) },
          conversationLinks: {
            create: normalized.conversationIds.map((conversationId) => ({ conversationId }))
          },
          companionLinks: {
            create: normalized.companionIds.map((companionId) => ({ companionId }))
          }
        }
      });

      if (normalized.entries.length > 0) {
        for (const entry of normalized.entries) {
          const entryId = randomUUID();
          const revisionId = randomUUID();
          const config = this.toEntryRevisionConfig({
            ...entry,
            compactContent: entry.compactContent ?? undefined,
            trustLevel: 'imported_untrusted'
          });
          await tx.worldBookEntry.create({
            data: { id: entryId, worldBookId: created.id, isEnabled: entry.isEnabled }
          });
          await tx.worldBookEntryRevision.create({
            data: {
              id: revisionId,
              entryId,
              version: 1,
              configJson: canonicalJson(config),
              content: entry.content,
              compactContent: entry.compactContent?.trim() || null,
              compactSourceHash: entry.compactContent?.trim()
                ? canonicalSha256(entry.content)
                : null,
              contentHash: canonicalSha256(entry.content)
            }
          });
          await tx.worldBookEntry.update({
            where: { id: entryId },
            data: { activeRevisionId: revisionId }
          });
        }
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
          personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
          conversationLinks: {
            select: { conversationId: true },
            orderBy: { createdAt: 'asc' }
          },
          companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: { createdAt: 'asc' },
            include: { activeRevision: true }
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
        formatVersion: 'tavern-lite.world-book.v2',
        name: '示例世界书',
        description: '描述这本世界书适用的角色、场景或背景设定。',
        characterIds: [],
        personaIds: [],
        conversationIds: [],
        companionIds: [],
        isEnabled: false,
        scanDepth: 6,
        tokenBudget: 1000,
        metadata: {},
        entries: [
          {
            title: '示例条目',
            content: '关键词命中后注入 Prompt 的设定内容。',
            contentType: 'lore',
            trustLevel: 'imported_untrusted',
            activationMode: 'keyword',
            matchMode: 'normalized_phrase',
            keywords: ['示例关键词'],
            secondaryKeywords: [],
            primaryLogic: 'any',
            secondaryLogic: 'and_any',
            excludeKeywords: [],
            sameMessageOnly: true,
            scanSources: ['current_user', 'user_history', 'assistant_latest'],
            userHistoryScanDepth: 6,
            stickyTurns: 0,
            continuationTurns: 1,
            cooldownTurns: 0,
            delayTurns: 0,
            cooldownPolicy: 'strict',
            generationPurposes: ['chat_reply', 'regenerate', 'continue'],
            budgetPriority: 0,
            sortOrder: 0,
            isEnabled: true,
            insertionOrder: 'before_history',
            tokenBudget: null,
            compactContent: null
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

  async exportJson(currentUser: CurrentUser, id: string) {
    await this.findOwnedActiveWorldBook(currentUser, id);
    const worldBook = await this.prisma.worldBook.findUniqueOrThrow({
      where: { id },
      include: {
        characterLinks: { select: { characterId: true }, orderBy: { createdAt: 'asc' } },
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
        }
      }
    });
    return {
      fileName: `${safeExportFileName(worldBook.name)}-world-book.json`,
      card: {
        formatVersion: 'tavern-lite.world-book.v2',
        name: worldBook.name,
        description: worldBook.description,
        characterIds: worldBook.characterLinks.map((link) => link.characterId),
        personaIds: worldBook.personaLinks.map((link) => link.personaId),
        conversationIds: worldBook.conversationLinks.map((link) => link.conversationId),
        companionIds: worldBook.companionLinks.map((link) => link.companionId),
        isEnabled: worldBook.isEnabled,
        scanDepth: worldBook.scanDepth,
        tokenBudget: worldBook.tokenBudget,
        metadata: this.parseRecord(worldBook.metadataJson),
        entries: worldBook.entries.map((entry) => {
          const config = this.parseRecord(entry.activeRevision?.configJson ?? null) ?? {};
          return {
            title: typeof config.title === 'string' ? config.title : '',
            content: entry.activeRevision?.content ?? '',
            compactContent: entry.activeRevision?.compactContent ?? null,
            contentType: config.contentType ?? 'lore',
            trustLevel: config.trustLevel ?? 'user_authored',
            activationMode: config.activationMode ?? 'keyword',
            matchMode: config.matchMode ?? 'normalized_phrase',
            keywords: this.arrayOfStrings(config.primaryKeywords),
            primaryLogic: config.primaryLogic ?? 'any',
            secondaryKeywords: this.arrayOfStrings(config.secondaryKeywords),
            secondaryLogic: config.secondaryLogic ?? 'and_any',
            excludeKeywords: config.excludeKeywords ?? [],
            sameMessageOnly: config.sameMessageOnly ?? true,
            scanSources: config.scanSources ?? ['current_user', 'user_history', 'assistant_latest'],
            userHistoryScanDepth: config.userHistoryScanDepth ?? 6,
            stickyTurns: config.stickyTurns ?? 0,
            continuationTurns: config.continuationTurns ?? 1,
            cooldownTurns: config.cooldownTurns ?? 0,
            delayTurns: config.delayTurns ?? 0,
            cooldownPolicy: config.cooldownPolicy ?? 'strict',
            generationPurposes: config.generationPurposes ?? [
              'chat_reply',
              'regenerate',
              'continue'
            ],
            budgetPriority: config.budgetPriority ?? 0,
            sortOrder: config.sortOrder ?? 0,
            isEnabled: entry.isEnabled,
            insertionOrder: placementToInsertionOrder(config.placement),
            tokenBudget: typeof config.maxTokens === 'number' ? config.maxTokens : null
          };
        }),
        exportedAt: new Date().toISOString()
      }
    };
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
        for (const entry of source.entries) {
          if (!entry.activeRevision) continue;
          const entryId = randomUUID();
          const revisionId = randomUUID();
          await tx.worldBookEntry.create({
            data: {
              id: entryId,
              worldBookId: created.id,
              isEnabled: entry.isEnabled
            }
          });
          await tx.worldBookEntryRevision.create({
            data: {
              id: revisionId,
              entryId,
              version: 1,
              configJson: entry.activeRevision.configJson,
              content: entry.activeRevision.content,
              compactContent: entry.activeRevision.compactContent,
              compactSourceHash: entry.activeRevision.compactSourceHash,
              contentHash: entry.activeRevision.contentHash
            }
          });
          await tx.worldBookEntry.update({
            where: { id: entryId },
            data: { activeRevisionId: revisionId }
          });
        }
      }
      return tx.worldBook.findFirstOrThrow({
        where: { id: created.id },
        include: {
          characterLinks: {
            select: { characterId: true },
            orderBy: { createdAt: 'asc' }
          },
          personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
          conversationLinks: {
            select: { conversationId: true },
            orderBy: { createdAt: 'asc' }
          },
          companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
          entries: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: { activeRevision: true }
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
    const [characterIds, personaIds, conversationIds, companionIds] = await Promise.all([
      dto.characterIds === undefined
        ? undefined
        : this.resolveCharacterIds(currentUser, dto.characterIds),
      dto.personaIds === undefined
        ? undefined
        : this.resolvePersonaIds(currentUser, dto.personaIds),
      dto.conversationIds === undefined
        ? undefined
        : this.resolveConversationIds(currentUser, dto.conversationIds),
      dto.companionIds === undefined
        ? undefined
        : this.resolveCompanionIds(currentUser, dto.companionIds)
    ]);

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
        ...(personaIds === undefined
          ? {}
          : {
              personaLinks: {
                deleteMany: {},
                create: personaIds.map((personaId) => ({ personaId }))
              }
            }),
        ...(conversationIds === undefined
          ? {}
          : {
              conversationLinks: {
                deleteMany: {},
                create: conversationIds.map((conversationId) => ({ conversationId }))
              }
            }),
        ...(companionIds === undefined
          ? {}
          : {
              companionLinks: {
                deleteMany: {},
                create: companionIds.map((companionId) => ({ companionId }))
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
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
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

    const entryId = randomUUID();
    const revisionId = randomUUID();
    const config = this.toEntryRevisionConfig(dto);
    const entry = await this.prisma.$transaction(async (tx) => {
      await tx.worldBookEntry.create({
        data: {
          id: entryId,
          worldBookId,
          isEnabled: dto.isEnabled ?? true
        }
      });
      await tx.worldBookEntryRevision.create({
        data: {
          id: revisionId,
          entryId,
          version: 1,
          configJson: canonicalJson(config),
          content: dto.content,
          compactContent: dto.compactContent?.trim() || null,
          compactSourceHash: dto.compactContent?.trim() ? canonicalSha256(dto.content) : null,
          contentHash: canonicalSha256(dto.content)
        }
      });
      return tx.worldBookEntry.update({
        where: { id: entryId },
        data: { activeRevisionId: revisionId },
        include: { activeRevision: true }
      });
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
    const current = await this.findOwnedActiveEntry(currentUser, id);

    // 部分更新：仅写入 DTO 中实际传入的字段；keywords/insertionOrder 需转换存储格式
    const previousRevision = current.activeRevision;
    if (!previousRevision) {
      throw new ConflictException({
        code: 'WORLD_BOOK_REVISION_REQUIRED',
        message: 'Entry has no active revision.'
      });
    }
    const config = this.toEntryRevisionConfig(dto, previousRevision.configJson);
    const nextContent = dto.content ?? previousRevision.content;
    const revisionId = randomUUID();
    const nextVersion =
      (
        await this.prisma.worldBookEntryRevision.aggregate({
          where: { entryId: id },
          _max: { version: true }
        })
      )._max.version ?? 0;
    const entry = await this.prisma.$transaction(async (tx) => {
      await tx.worldBookEntryRevision.create({
        data: {
          id: revisionId,
          entryId: id,
          version: nextVersion + 1,
          configJson: canonicalJson(config),
          content: nextContent,
          compactContent:
            dto.compactContent === undefined
              ? previousRevision.compactContent
              : dto.compactContent.trim() || null,
          compactSourceHash:
            dto.compactContent === undefined
              ? previousRevision.compactSourceHash
              : dto.compactContent.trim()
                ? canonicalSha256(nextContent)
                : null,
          contentHash: canonicalSha256(nextContent)
        }
      });
      const [conversationStates, companionStates] = await Promise.all([
        tx.conversationWorldBookActivationState.findMany({
          where: { entryId: id },
          select: { conversationId: true }
        }),
        tx.companionWorldBookActivationState.findMany({
          where: { entryId: id },
          select: { companionId: true }
        })
      ]);
      await tx.conversationWorldBookActivationState.deleteMany({ where: { entryId: id } });
      await tx.companionWorldBookActivationState.deleteMany({ where: { entryId: id } });
      const conversationIds = [...new Set(conversationStates.map((item) => item.conversationId))];
      const companionIds = [...new Set(companionStates.map((item) => item.companionId))];
      if (conversationIds.length)
        await tx.conversation.updateMany({
          where: { id: { in: conversationIds } },
          data: { version: { increment: 1 } }
        });
      if (companionIds.length)
        await tx.companion.updateMany({
          where: { id: { in: companionIds } },
          data: { version: { increment: 1 } }
        });
      return tx.worldBookEntry.update({
        where: { id },
        data: {
          activeRevisionId: revisionId,
          ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled })
        },
        include: { activeRevision: true }
      });
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

  async setManualActivation(
    currentUser: CurrentUser,
    entryId: string,
    dto: SetManualWorldBookActivationDto
  ) {
    const entry = await this.findOwnedActiveEntry(currentUser, entryId);
    if (!entry.activeRevisionId) {
      throw new ConflictException({
        code: 'WORLD_BOOK_REVISION_REQUIRED',
        message: 'Entry has no active revision.'
      });
    }
    if (dto.targetType === 'conversation') {
      const target = await this.prisma.conversation.findFirst({
        where: { id: dto.targetId, userId: currentUser.id, deletedAt: null },
        select: { id: true }
      });
      if (!target)
        throw new NotFoundException({
          code: ERROR_CODES.CONVERSATION_NOT_FOUND,
          message: 'Conversation not found.'
        });
      const latestTurn = await this.prisma.conversationTurn.aggregate({
        where: { conversationId: target.id },
        _max: { completedOrdinal: true }
      });
      return this.prisma.$transaction(async (tx) => {
        const sourceKey = `manual:${dto.operationId}`;
        const existingEvent = await tx.conversationWorldBookActivationEvent.findUnique({
          where: {
            conversationId_entryId_entryRevisionId_sourceKey: {
              conversationId: target.id,
              entryId,
              entryRevisionId: entry.activeRevisionId!,
              sourceKey
            }
          }
        });
        if (existingEvent) {
          const existingState = await tx.conversationWorldBookActivationState.findUnique({
            where: { conversationId_entryId: { conversationId: target.id, entryId } }
          });
          if (!existingState) {
            throw new ConflictException({
              code: 'WORLD_BOOK_STATE_MISSING',
              message: 'Idempotent activation event exists without runtime state.'
            });
          }
          return {
            targetType: dto.targetType,
            targetId: target.id,
            entryId,
            active: existingState.manualActive,
            stateVersion: existingState.stateVersion
          };
        }
        const state = await tx.conversationWorldBookActivationState.upsert({
          where: { conversationId_entryId: { conversationId: target.id, entryId } },
          create: {
            conversationId: target.id,
            entryId,
            entryRevisionId: entry.activeRevisionId!,
            lineageJson: JSON.stringify([entryId]),
            bridgeDepth: 0,
            manualActive: dto.active
          },
          update: {
            entryRevisionId: entry.activeRevisionId!,
            manualActive: dto.active,
            stateVersion: { increment: 1 }
          }
        });
        await tx.conversationWorldBookActivationEvent.upsert({
          where: {
            conversationId_entryId_entryRevisionId_sourceKey: {
              conversationId: target.id,
              entryId,
              entryRevisionId: entry.activeRevisionId!,
              sourceKey
            }
          },
          create: {
            conversationId: target.id,
            entryId,
            entryRevisionId: entry.activeRevisionId!,
            sourceType: dto.active ? 'manual' : 'manual_cancel',
            sourceKey,
            lineageJson: JSON.stringify([entryId]),
            bridgeDepth: 0,
            completedTurn: latestTurn._max.completedOrdinal ?? 0
          },
          update: {}
        });
        await tx.conversation.update({
          where: { id: target.id },
          data: { version: { increment: 1 } }
        });
        return {
          targetType: dto.targetType,
          targetId: target.id,
          entryId,
          active: state.manualActive,
          stateVersion: state.stateVersion
        };
      });
    }
    const target = await this.prisma.companion.findFirst({
      where: { id: dto.targetId, userId: currentUser.id, deletedAt: null },
      select: { id: true }
    });
    if (!target)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
    const latestTurn = await this.prisma.companionTurn.aggregate({
      where: { companionId: target.id },
      _max: { completedOrdinal: true }
    });
    return this.prisma.$transaction(async (tx) => {
      const sourceKey = `manual:${dto.operationId}`;
      const existingEvent = await tx.companionWorldBookActivationEvent.findUnique({
        where: {
          companionId_entryId_entryRevisionId_sourceKey: {
            companionId: target.id,
            entryId,
            entryRevisionId: entry.activeRevisionId!,
            sourceKey
          }
        }
      });
      if (existingEvent) {
        const existingState = await tx.companionWorldBookActivationState.findUnique({
          where: { companionId_entryId: { companionId: target.id, entryId } }
        });
        if (!existingState) {
          throw new ConflictException({
            code: 'WORLD_BOOK_STATE_MISSING',
            message: 'Idempotent activation event exists without runtime state.'
          });
        }
        return {
          targetType: dto.targetType,
          targetId: target.id,
          entryId,
          active: existingState.manualActive,
          stateVersion: existingState.stateVersion
        };
      }
      const state = await tx.companionWorldBookActivationState.upsert({
        where: { companionId_entryId: { companionId: target.id, entryId } },
        create: {
          companionId: target.id,
          entryId,
          entryRevisionId: entry.activeRevisionId!,
          lineageJson: JSON.stringify([entryId]),
          bridgeDepth: 0,
          manualActive: dto.active
        },
        update: {
          entryRevisionId: entry.activeRevisionId!,
          manualActive: dto.active,
          stateVersion: { increment: 1 }
        }
      });
      await tx.companionWorldBookActivationEvent.upsert({
        where: {
          companionId_entryId_entryRevisionId_sourceKey: {
            companionId: target.id,
            entryId,
            entryRevisionId: entry.activeRevisionId!,
            sourceKey
          }
        },
        create: {
          companionId: target.id,
          entryId,
          entryRevisionId: entry.activeRevisionId!,
          sourceType: dto.active ? 'manual' : 'manual_cancel',
          sourceKey,
          lineageJson: JSON.stringify([entryId]),
          bridgeDepth: 0,
          completedTurn: latestTurn._max.completedOrdinal ?? 0
        },
        update: {}
      });
      await tx.companion.update({ where: { id: target.id }, data: { version: { increment: 1 } } });
      return {
        targetType: dto.targetType,
        targetId: target.id,
        entryId,
        active: state.manualActive,
        stateVersion: state.stateVersion
      };
    });
  }

  async listRuntimeStates(
    currentUser: CurrentUser,
    targetType: 'conversation' | 'companion',
    targetId: string
  ) {
    if (targetType === 'conversation') {
      const target = await this.prisma.conversation.findFirst({
        where: { id: targetId, userId: currentUser.id, deletedAt: null },
        select: { id: true, characterId: true, personaId: true }
      });
      if (!target)
        throw new NotFoundException({
          code: ERROR_CODES.CONVERSATION_NOT_FOUND,
          message: 'Conversation not found.'
        });
      const [books, states] = await Promise.all([
        this.listPromptContexts(currentUser, target.characterId, {
          conversationId: target.id,
          personaId: target.personaId
        }),
        this.prisma.conversationWorldBookActivationState.findMany({
          where: { conversationId: target.id }
        })
      ]);
      return this.toRuntimeStateResponse(targetType, target.id, books, states);
    }
    const target = await this.prisma.companion.findFirst({
      where: { id: targetId, userId: currentUser.id, deletedAt: null },
      select: { id: true, personaId: true }
    });
    if (!target)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
    const [books, states] = await Promise.all([
      this.listPromptContexts(currentUser, null, {
        companionId: target.id,
        personaId: target.personaId
      }),
      this.prisma.companionWorldBookActivationState.findMany({
        where: { companionId: target.id }
      })
    ]);
    return this.toRuntimeStateResponse(targetType, target.id, books, states);
  }

  private toRuntimeStateResponse(
    targetType: 'conversation' | 'companion',
    targetId: string,
    books: WorldBookContext[],
    states: Array<{
      entryId: string;
      entryRevisionId: string;
      activatedAtCompletedTurn: number | null;
      stickyUntilCompletedTurn: number | null;
      continuationUntilCompletedTurn: number | null;
      cooldownUntilCompletedTurn: number | null;
      pendingUntilCompletedTurn: number | null;
      manualActive: boolean;
      stateVersion: number;
    }>
  ) {
    const stateByEntry = new Map(states.map((state) => [state.entryId, state]));
    return {
      targetType,
      targetId,
      entries: books.flatMap((book) =>
        book.entries.map((entry) => {
          const context = entry.config;
          const state = stateByEntry.get(entry.id) ?? null;
          return {
            worldBookId: book.id,
            worldBookName: book.name,
            entryId: entry.id,
            entryRevisionId: entry.activeRevisionId ?? null,
            title: entry.title,
            activationMode:
              typeof context.activationMode === 'string' ? context.activationMode : 'keyword',
            contentType: typeof context.contentType === 'string' ? context.contentType : 'lore',
            trustLevel:
              typeof context.trustLevel === 'string' ? context.trustLevel : 'user_authored',
            state
          };
        })
      )
    };
  }

  /**
   * 归一化世界书导入 JSON。
   * @param currentUser 当前登录用户。
   * @param record 原始 JSON 对象。
   * @returns 可写入数据库的世界书导入数据。
   */
  private async normalizeWorldBookImport(
    currentUser: CurrentUser,
    record: JsonRecord
  ): Promise<NormalizedWorldBookImport> {
    const warnings: ModuleJsonImportWarning[] = [];
    const name = limitText(requiredString(record, 'name', 'name'), 120, 'name', warnings);

    const [characterIds, personaIds, conversationIds, companionIds] = await Promise.all([
      this.resolveCharacterIds(
        currentUser,
        optionalStringArray(record, 'characterIds', 'characterIds')
      ),
      this.resolvePersonaIds(currentUser, optionalStringArray(record, 'personaIds', 'personaIds')),
      this.resolveConversationIds(
        currentUser,
        optionalStringArray(record, 'conversationIds', 'conversationIds')
      ),
      this.resolveCompanionIds(
        currentUser,
        optionalStringArray(record, 'companionIds', 'companionIds')
      )
    ]);
    return {
      name,
      description: limitText(
        optionalString(record, 'description', 'description') ?? '',
        10000,
        'description',
        warnings
      ),
      characterIds,
      personaIds,
      conversationIds,
      companionIds,
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

      const tokenBudget = optionalNullableInteger(
        record,
        'tokenBudget',
        `entries[${index}].tokenBudget`
      );
      const insertionOrder = this.normalizeInsertionOrder(
        record.insertionOrder,
        `entries[${index}].insertionOrder`
      );
      const requestedContentType = importEnum(
        record.contentType,
        ['lore', 'state', 'behavior_rule', 'reference'],
        'lore',
        `entries[${index}].contentType`
      );
      const contentType = requestedContentType === 'behavior_rule' ? 'lore' : requestedContentType;
      if (requestedContentType === 'behavior_rule') {
        warnings.push({
          code: 'IMPORTED_BEHAVIOR_RULE_DOWNGRADED',
          field: `entries[${index}].contentType`,
          message: '未确认的导入行为规则已降级为 lore。'
        });
      }
      const scanSources = optionalStringArray(
        record,
        'scanSources',
        `entries[${index}].scanSources`
      );
      const generationPurposes = optionalStringArray(
        record,
        'generationPurposes',
        `entries[${index}].generationPurposes`
      );
      const contextV2 = {
        title: requiredString(record, 'title', `entries[${index}].title`),
        contentType,
        trustLevel: 'imported_untrusted',
        activationMode: importEnum(
          record.activationMode,
          ['constant', 'keyword', 'manual'],
          'keyword',
          `entries[${index}].activationMode`
        ),
        matchMode: importEnum(
          record.matchMode,
          ['contains', 'normalized_phrase'],
          'normalized_phrase',
          `entries[${index}].matchMode`
        ),
        primaryKeywords: keywords,
        primaryLogic: importEnum(
          record.primaryLogic,
          ['any', 'all'],
          'any',
          `entries[${index}].primaryLogic`
        ),
        secondaryKeywords: optionalStringArray(
          record,
          'secondaryKeywords',
          `entries[${index}].secondaryKeywords`
        ),
        secondaryLogic: importEnum(
          record.secondaryLogic,
          ['and_any', 'and_all', 'not_any', 'not_all'],
          'and_any',
          `entries[${index}].secondaryLogic`
        ),
        excludeKeywords: optionalStringArray(
          record,
          'excludeKeywords',
          `entries[${index}].excludeKeywords`
        ),
        sameMessageOnly: optionalBoolean(
          record,
          'sameMessageOnly',
          true,
          `entries[${index}].sameMessageOnly`
        ),
        scanSources: scanSources.length
          ? scanSources
          : ['current_user', 'user_history', 'assistant_latest'],
        userHistoryScanDepth: optionalInteger(
          record,
          'userHistoryScanDepth',
          6,
          `entries[${index}].userHistoryScanDepth`
        ),
        stickyTurns: optionalInteger(record, 'stickyTurns', 0, `entries[${index}].stickyTurns`),
        continuationTurns: optionalInteger(
          record,
          'continuationTurns',
          1,
          `entries[${index}].continuationTurns`
        ),
        cooldownTurns: optionalInteger(
          record,
          'cooldownTurns',
          0,
          `entries[${index}].cooldownTurns`
        ),
        delayTurns: optionalInteger(record, 'delayTurns', 0, `entries[${index}].delayTurns`),
        cooldownPolicy: importEnum(
          record.cooldownPolicy,
          ['strict', 'current_user_override'],
          'strict',
          `entries[${index}].cooldownPolicy`
        ),
        generationPurposes: generationPurposes.length
          ? generationPurposes
          : ['chat_reply', 'regenerate', 'continue'],
        budgetPriority: optionalInteger(
          record,
          'budgetPriority',
          0,
          `entries[${index}].budgetPriority`
        ),
        sortOrder: optionalInteger(record, 'sortOrder', 0, `entries[${index}].sortOrder`),
        placement: importPlacement(insertionOrder),
        maxTokens: tokenBudget
      };
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
        insertionOrder,
        tokenBudget,
        contentType,
        trustLevel: 'imported_untrusted',
        activationMode: contextV2.activationMode,
        matchMode: contextV2.matchMode,
        primaryLogic: contextV2.primaryLogic,
        secondaryLogic: contextV2.secondaryLogic,
        excludeKeywords: contextV2.excludeKeywords,
        sameMessageOnly: contextV2.sameMessageOnly,
        scanSources: contextV2.scanSources,
        userHistoryScanDepth: contextV2.userHistoryScanDepth,
        stickyTurns: contextV2.stickyTurns,
        continuationTurns: contextV2.continuationTurns,
        cooldownTurns: contextV2.cooldownTurns,
        delayTurns: contextV2.delayTurns,
        cooldownPolicy: contextV2.cooldownPolicy,
        generationPurposes: contextV2.generationPurposes,
        budgetPriority: contextV2.budgetPriority,
        sortOrder: contextV2.sortOrder,
        compactContent:
          optionalString(record, 'compactContent', `entries[${index}].compactContent`) || null
      };
    });
  }

  /**
   * 校验导入条目的 V2 插入位置。
   * @param value 原始 insertionOrder。
   * @param path 字段路径。
   * @returns 世界书条目插入位置。
   */
  private normalizeInsertionOrder(value: unknown, path: string): WorldBookEntryInsertionOrder {
    if (value === undefined || value === null || value === '') {
      return 'before_history';
    }

    if (typeof value !== 'string') {
      throw invalidModuleFormat(`${path} must be a string when present.`);
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
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
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
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
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
        personaLinks: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
        conversationLinks: {
          select: { conversationId: true },
          orderBy: { createdAt: 'asc' }
        },
        companionLinks: { select: { companionId: true }, orderBy: { createdAt: 'asc' } },
        entries: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { activeRevision: true }
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
        worldBook: true,
        activeRevision: true
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

  private normalizeBindingIds(ids: string[]): string[] {
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  }

  private async resolvePersonaIds(currentUser: CurrentUser, ids: string[]): Promise<string[]> {
    const normalizedIds = this.normalizeBindingIds(ids);
    if (!normalizedIds.length) return [];
    const found = await this.prisma.userPersona.findMany({
      where: { id: { in: normalizedIds }, userId: currentUser.id, deletedAt: null },
      select: { id: true }
    });
    this.assertAllBindingsFound(normalizedIds, found, 'PERSONA_NOT_FOUND', 'Persona not found.');
    return normalizedIds;
  }

  private async resolveConversationIds(currentUser: CurrentUser, ids: string[]): Promise<string[]> {
    const normalizedIds = this.normalizeBindingIds(ids);
    if (!normalizedIds.length) return [];
    const found = await this.prisma.conversation.findMany({
      where: { id: { in: normalizedIds }, userId: currentUser.id, deletedAt: null },
      select: { id: true }
    });
    this.assertAllBindingsFound(
      normalizedIds,
      found,
      'CONVERSATION_NOT_FOUND',
      'Conversation not found.'
    );
    return normalizedIds;
  }

  private async resolveCompanionIds(currentUser: CurrentUser, ids: string[]): Promise<string[]> {
    const normalizedIds = this.normalizeBindingIds(ids);
    if (!normalizedIds.length) return [];
    const found = await this.prisma.companion.findMany({
      where: { id: { in: normalizedIds }, userId: currentUser.id, deletedAt: null },
      select: { id: true }
    });
    this.assertAllBindingsFound(
      normalizedIds,
      found,
      'COMPANION_NOT_FOUND',
      'Companion not found.'
    );
    return normalizedIds;
  }

  private assertAllBindingsFound(
    expectedIds: string[],
    found: Array<{ id: string }>,
    code: string,
    message: string
  ): void {
    const foundIds = new Set(found.map((item) => item.id));
    if (expectedIds.some((id) => !foundIds.has(id))) {
      throw new BadRequestException({ code, message });
    }
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
      personaIds: worldBook.personaLinks.map((link) => link.personaId),
      conversationIds: worldBook.conversationLinks.map((link) => link.conversationId),
      companionIds: worldBook.companionLinks.map((link) => link.companionId),
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
      personaIds: worldBook.personaLinks.map((link) => link.personaId),
      conversationIds: worldBook.conversationLinks.map((link) => link.conversationId),
      companionIds: worldBook.companionLinks.map((link) => link.companionId),
      name: worldBook.name,
      description: worldBook.description,
      isEnabled: worldBook.isEnabled,
      isSensitive: worldBook.isSensitive,
      scanDepth: worldBook.scanDepth,
      tokenBudget: worldBook.tokenBudget,
      metadata: this.parseRecord(worldBook.metadataJson),
      entries: worldBook.entries.flatMap((entry) =>
        entry.activeRevision ? [this.toPromptEntryContext(entry)] : []
      )
    };
  }

  /**
   * 条目 → prompt 构建用的条目上下文。
   * @param entry 条目记录。
   * @returns 条目上下文。
   */
  private toPromptEntryContext(
    entry: WorldBookEntry & { activeRevision: WorldBookEntryRevision | null }
  ): WorldBookEntryContext {
    const revision = entry.activeRevision;
    if (!revision) {
      throw new ConflictException({
        code: 'WORLD_BOOK_REVISION_REQUIRED',
        message: 'Entry has no active revision.'
      });
    }
    const config = this.parseRecord(revision.configJson) ?? {};
    return {
      id: entry.id,
      activeRevisionId: revision.id,
      worldBookId: entry.worldBookId,
      title: typeof config.title === 'string' ? config.title : '',
      content: revision.content,
      compactContent: revision.compactContent,
      compactSourceHash: revision.compactSourceHash,
      keywords: this.arrayOfStrings(config.primaryKeywords),
      secondaryKeywords: this.arrayOfStrings(config.secondaryKeywords),
      isEnabled: entry.isEnabled,
      budgetPriority: typeof config.budgetPriority === 'number' ? config.budgetPriority : 0,
      sortOrder: typeof config.sortOrder === 'number' ? config.sortOrder : 0,
      position: placementToInsertionOrder(config.placement),
      tokenBudget: typeof config.maxTokens === 'number' ? config.maxTokens : null,
      config
    };
  }

  /**
   * 条目记录 → 对外响应（解析关键词数组、metadata、格式化时间）。
   * @param entry 条目记录。
   * @returns 条目响应。
   */
  private toEntryResponse(
    entry: WorldBookEntry & { activeRevision?: WorldBookEntryRevision | null }
  ): WorldBookEntryResponse {
    const revision = entry.activeRevision;
    if (!revision) {
      throw new ConflictException({
        code: 'WORLD_BOOK_REVISION_REQUIRED',
        message: 'Entry has no active revision.'
      });
    }
    const config = this.parseRecord(revision.configJson) ?? {};
    return {
      id: entry.id,
      activeRevisionId: revision.id,
      worldBookId: entry.worldBookId,
      title: typeof config.title === 'string' ? config.title : '',
      content: revision.content,
      keywords: this.arrayOfStrings(config.primaryKeywords),
      secondaryKeywords: this.arrayOfStrings(config.secondaryKeywords),
      isEnabled: entry.isEnabled,
      insertionOrder: placementToInsertionOrder(config.placement),
      tokenBudget: typeof config.maxTokens === 'number' ? config.maxTokens : null,
      contentType: typeof config.contentType === 'string' ? config.contentType : 'lore',
      trustLevel: typeof config.trustLevel === 'string' ? config.trustLevel : 'user_authored',
      activationMode: typeof config.activationMode === 'string' ? config.activationMode : 'keyword',
      matchMode: typeof config.matchMode === 'string' ? config.matchMode : 'normalized_phrase',
      primaryLogic: typeof config.primaryLogic === 'string' ? config.primaryLogic : 'any',
      secondaryLogic: typeof config.secondaryLogic === 'string' ? config.secondaryLogic : 'and_any',
      excludeKeywords: this.arrayOfStrings(config.excludeKeywords),
      sameMessageOnly: typeof config.sameMessageOnly === 'boolean' ? config.sameMessageOnly : true,
      scanSources: this.arrayOfStrings(config.scanSources, [
        'current_user',
        'user_history',
        'assistant_latest'
      ]),
      userHistoryScanDepth:
        typeof config.userHistoryScanDepth === 'number' ? config.userHistoryScanDepth : 6,
      stickyTurns: typeof config.stickyTurns === 'number' ? config.stickyTurns : 0,
      continuationTurns:
        typeof config.continuationTurns === 'number' ? config.continuationTurns : 1,
      cooldownTurns: typeof config.cooldownTurns === 'number' ? config.cooldownTurns : 0,
      delayTurns: typeof config.delayTurns === 'number' ? config.delayTurns : 0,
      cooldownPolicy: typeof config.cooldownPolicy === 'string' ? config.cooldownPolicy : 'strict',
      generationPurposes: this.arrayOfStrings(config.generationPurposes, [
        'chat_reply',
        'regenerate',
        'continue'
      ]),
      budgetPriority: typeof config.budgetPriority === 'number' ? config.budgetPriority : 0,
      sortOrder: typeof config.sortOrder === 'number' ? config.sortOrder : 0,
      compactContent: revision.compactContent,
      compactSourceHash: revision.compactSourceHash,
      compactStale: Boolean(
        revision.compactContent && revision.compactSourceHash !== canonicalSha256(revision.content)
      ),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    };
  }

  private toEntryRevisionConfig(
    dto: CreateWorldBookEntryDto | UpdateWorldBookEntryDto,
    previousJson?: string | null
  ): Record<string, unknown> {
    const previous = this.parseRecord(previousJson ?? null) ?? {};
    const contentType = dto.contentType ?? previous.contentType ?? 'lore';
    const placementDefaults: Record<string, string> = {
      lore: 'before_history',
      state: 'before_current_user',
      behavior_rule: 'instruction',
      reference: 'after_history'
    };
    const trustLevel = dto.trustLevel ?? previous.trustLevel ?? 'user_authored';
    if (trustLevel === 'imported_untrusted' && contentType === 'behavior_rule') {
      throw new BadRequestException({
        code: 'WORLD_BOOK_TRUST_VIOLATION',
        message: 'Unconfirmed imported content cannot be a behavior rule.'
      });
    }
    const pick = (key: string, fallback: unknown) => {
      const value = (dto as unknown as Record<string, unknown>)[key];
      return value === undefined ? (previous[key] ?? fallback) : value;
    };
    return {
      title: pick('title', ''),
      contentType,
      trustLevel,
      activationMode: pick('activationMode', 'keyword'),
      matchMode: pick('matchMode', 'normalized_phrase'),
      primaryKeywords: pick('keywords', []),
      primaryLogic: pick('primaryLogic', 'any'),
      secondaryKeywords: pick('secondaryKeywords', []),
      secondaryLogic: pick('secondaryLogic', 'and_any'),
      excludeKeywords: pick('excludeKeywords', []),
      sameMessageOnly: pick('sameMessageOnly', true),
      scanSources: pick('scanSources', ['current_user', 'user_history', 'assistant_latest']),
      userHistoryScanDepth: pick('userHistoryScanDepth', 6),
      stickyTurns: pick('stickyTurns', 0),
      continuationTurns: pick('continuationTurns', 1),
      cooldownTurns: pick('cooldownTurns', 0),
      delayTurns: pick('delayTurns', 0),
      cooldownPolicy: pick('cooldownPolicy', 'strict'),
      generationPurposes: pick('generationPurposes', ['chat_reply', 'regenerate', 'continue']),
      budgetPriority: pick('budgetPriority', 0),
      sortOrder: pick('sortOrder', 0),
      placement: pick('insertionOrder', placementDefaults[String(contentType)] ?? 'before_history'),
      maxTokens: pick('tokenBudget', null)
    };
  }

  /**
   * 把结构化数据序列化成 JSON 字符串；undefined/null 返回 null。
   * @param value 任意值。
   * @returns JSON 字符串，undefined/null 返回 null。
   */
  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private arrayOfStrings(value: unknown, fallback: string[] = []): string[] {
    if (!Array.isArray(value)) return fallback;
    const result = value.filter((item): item is string => typeof item === 'string');
    return result.length ? result : fallback;
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

function importEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  path: string
): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw invalidModuleFormat(`${path} has an unsupported value.`);
  }
  return value as T;
}

function importPlacement(value: WorldBookEntryInsertionOrder): string {
  if (value === 'before_current_user_input' || value === 'after_current_user_input') {
    return 'before_current_user';
  }
  return value;
}

function placementToInsertionOrder(value: unknown): WorldBookEntryInsertionOrder {
  if (value === 'after_history') return 'after_history';
  if (value === 'before_current_user' || value === 'before_current_user_input') {
    return 'before_current_user_input';
  }
  if (value === 'after_current_user' || value === 'after_current_user_input') {
    return 'after_current_user_input';
  }
  return 'before_history';
}

function safeExportFileName(value: string): string {
  return (
    Array.from(value)
      .filter((character) => character.charCodeAt(0) >= 32)
      .join('')
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'world-book'
  );
}
