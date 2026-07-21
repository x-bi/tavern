import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Asset, Character } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CHARACTER_AVATAR_KIND } from '../assets/assets.constants';
import { AssetsService } from '../assets/assets.service';
import { ContentLibraryService } from '../content-library/content-library.service';
import type { CurrentUser } from '../users/user.types';
import type {
  CharacterExportResponse,
  CharacterImportPreview,
  CharacterImportResponse,
  CharacterListResponse,
  CharacterResponse,
  ExampleMessage
} from './character.types';
import type { CreateCharacterDto } from './dto/create-character.dto';
import type { ImportCharacterDto } from './dto/import-character.dto';
import type { QueryCharactersDto } from './dto/query-characters.dto';
import type { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterCardJsonExporter } from './export/character-card-json-exporter';
import { CharacterCardJsonImporter } from './import/character-card-json-importer';

/** 角色记录 + 关联的头像素材（include avatarAsset 后的形态）。 */
type CharacterWithAvatar = Character & {
  avatarAsset: Asset | null;
};

/**
 * 角色服务：角色的 CRUD、导入导出。
 *
 * exporter / importer 是无状态的纯工具类，直接 new 实例复用（无需 DI）。
 * 所有查询都按 userId 隔离，确保用户只能访问自己的角色。
 */
@Injectable()
export class CharactersService {
  /** 角色卡导出器（角色记录 → chara_card_v2 格式）。 */
  private readonly exporter = new CharacterCardJsonExporter();
  /** 角色卡导入器（chara_card_v2 JSON → 结构化字段）。 */
  private readonly importer = new CharacterCardJsonImporter();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AssetsService)
    private readonly assetsService: AssetsService,
    @Inject(ContentLibraryService)
    private readonly contentLibraryService: ContentLibraryService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 分页查询当前用户的角色列表。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/归档过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(currentUser: CurrentUser, query: QueryCharactersDto): Promise<CharacterListResponse> {
    // 分页参数兜底
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
      // isArchived 未传时不加条件（查全部），传了则按值过滤归档/未归档
      ...(query.isArchived === undefined ? {} : { isArchived: query.isArchived }),
      // search 关键字：匹配 name/description/personality/scenario 任一包含
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
              { personality: { contains: query.search } },
              { scenario: { contains: query.search } }
            ]
          }
        : {})
    };

    // 事务内并行：查当前页数据 + 统计符合条件的总数（两者共用同一 where）
    const [items, total] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where,
        include: {
          avatarAsset: true
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.character.count({ where })
    ]);
    const ownerNames = access.isManaged
      ? await this.contentLibraryService.getOwnerNameMap(items.map((item) => item.userId))
      : null;

    return {
      items: items.map((character) =>
        this.toResponse(
          character,
          currentUser,
          ownerNames?.get(character.userId) ?? access.ownerName
        )
      ),
      total,
      page,
      pageSize
    };
  }

  /**
   * 创建角色。
   * @param currentUser 当前登录用户（角色归属于该用户）。
   * @param dto 创建入参。
   * @returns 创建后的角色响应。
   * @throws BadRequestException 传了 avatarAssetId 但素材不存在/不属于该用户/非头像类型。
   */
  async create(currentUser: CurrentUser, dto: CreateCharacterDto): Promise<CharacterResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    // 校验头像素材归属（传了才校验，返回校验通过的 assetId）
    const avatarAssetId = await this.resolveAvatarAssetId(currentUser, dto.avatarAssetId);
    const character = await this.prisma.character.create({
      data: {
        userId: currentUser.id,
        avatarAssetId,
        name: dto.name,
        // 可选字段未传时落库为空串（避免 null）
        description: dto.description ?? '',
        personality: dto.personality ?? '',
        scenario: dto.scenario ?? '',
        firstMessage: dto.firstMessage ?? '',
        // exampleMessages / metadata 是结构化数据，序列化成 JSON 字符串存储
        exampleMessagesJson: this.stringifyNullable(dto.exampleMessages),
        metadataJson: this.stringifyNullable(dto.metadata),
        isSensitive: dto.isSensitive ?? false,
        isShared: dto.isShared ?? false,
        isArchived: dto.isArchived ?? false
      },
      include: {
        avatarAsset: true
      }
    });

    return this.toResponse(character, currentUser);
  }

  /**
   * 导入角色卡 JSON，支持预览/正式提交两阶段。
   *
   * @param currentUser 当前登录用户。
   * @param dto 导入入参；commit=false 仅预览，commit=true 正式落库。
   * @returns imported=false 返回预览，imported=true 返回已导入的角色。
   * @throws ConflictException 名称冲突且未选择 rename 策略时抛出。
   */
  async importJson(
    currentUser: CurrentUser,
    dto: ImportCharacterDto
  ): Promise<CharacterImportResponse> {
    // 解析卡片 JSON，映射成结构化字段（importer 内部做格式兼容、字段提取、敏感字段过滤）
    const mapped = this.importer.map(dto.rawJson);
    // 生成导入预览：检测同名角色冲突，冲突时生成建议副本名
    const preview = await this.toImportPreview(currentUser, mapped);

    // 预览模式（commit 未传或 false）：不落库，直接返回预览供前端确认
    if (!dto.commit) {
      return {
        imported: false,
        preview,
        character: null
      };
    }

    // 决定最终名称：冲突且选择 rename 策略时改用建议副本名，否则用原名
    const importName =
      preview.nameConflict && dto.duplicateNameStrategy === 'rename'
        ? preview.suggestedName
        : preview.name;

    // rename 策略但没有可用建议名：无法继续导入
    if (!importName) {
      throw new ConflictException({
        code: ERROR_CODES.CHARACTER_IMPORT_NAME_EXISTS,
        message: 'Character name already exists.',
        details: {
          name: preview.name,
          suggestedName: preview.suggestedName
        }
      });
    }

    // 冲突但未选择 rename 策略：要求前端显式选择 rename 才能导入副本
    if (preview.nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: ERROR_CODES.CHARACTER_IMPORT_NAME_EXISTS,
        message: 'Character name already exists. Choose a rename strategy to import a copy.',
        details: {
          name: preview.name,
          suggestedName: preview.suggestedName
        }
      });
    }

    // 正式落库（导入的角色暂不带头像）
    const character = await this.prisma.character.create({
      data: {
        userId: currentUser.id,
        avatarAssetId: null,
        name: importName,
        description: preview.description,
        personality: preview.personality,
        scenario: preview.scenario,
        firstMessage: preview.firstMessage,
        exampleMessagesJson: this.stringifyNullable(preview.exampleMessages),
        metadataJson: this.stringifyNullable(preview.metadata),
        isSensitive: false,
        isShared: false,
        isArchived: false
      },
      include: {
        avatarAsset: true
      }
    });

    return {
      imported: true,
      preview: {
        ...preview,
        name: importName,
        nameConflict: false,
        suggestedName: null
      },
      character: this.toResponse(character, currentUser)
    };
  }

  /** 返回可直接用于角色卡导入的 chara_card_v2 模板。 */
  getImportTemplate() {
    return {
      fileName: 'tavern-lite-character-template.json',
      template: {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: '示例角色',
          description: '角色的背景、身份与外观设定。',
          personality: '角色的性格、习惯与表达方式。',
          scenario: '角色与用户当前所处的场景。',
          first_mes: '你好，很高兴见到你。',
          mes_example: '<START>\n{{user}}: 你好\n示例角色: 你好呀，今天过得怎么样？'
        }
      }
    };
  }

  /**
   * 获取单个角色。
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @returns 角色响应。
   * @throws NotFoundException 角色不存在或不属于当前用户。
   */
  async getById(currentUser: CurrentUser, id: string): Promise<CharacterResponse> {
    const character = await this.findVisibleActiveCharacter(currentUser, id);
    const ownerNames =
      character.userId === currentUser.id
        ? null
        : await this.contentLibraryService.getOwnerNameMap([character.userId]);
    return this.toResponse(character, currentUser, ownerNames?.get(character.userId) ?? null);
  }

  /** 复制内容库主数据和头像，生成只属于当前用户的静态副本。 */
  async fork(currentUser: CurrentUser, id: string): Promise<CharacterResponse> {
    const source = await this.findLibraryCharacter(currentUser, id);
    const preparedAvatar = await this.assetsService.prepareCharacterAvatarCopy(
      source.userId,
      currentUser.id,
      source.avatarAssetId
    );
    const name = await this.createSuggestedImportName(currentUser, source.name);

    try {
      const character = await this.prisma.$transaction(async (tx) => {
        const asset = preparedAvatar ? await tx.asset.create({ data: preparedAvatar.data }) : null;
        return tx.character.create({
          data: {
            userId: currentUser.id,
            avatarAssetId: asset?.id ?? null,
            name,
            description: source.description,
            personality: source.personality,
            scenario: source.scenario,
            firstMessage: source.firstMessage,
            exampleMessagesJson: source.exampleMessagesJson,
            metadataJson: source.metadataJson,
            isSensitive: source.isSensitive,
            isShared: false,
            isArchived: false
          },
          include: { avatarAsset: true }
        });
      });
      return this.toResponse(character, currentUser);
    } catch (error) {
      await this.assetsService.discardPreparedAvatarCopy(preparedAvatar);
      throw error;
    }
  }

  /**
   * 导出角色为 chara_card_v2 JSON。
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @returns 含文件名、卡片、导出时间、原始示例对话。
   * @throws NotFoundException 角色不存在或不属于当前用户。
   */
  async exportJson(currentUser: CurrentUser, id: string): Promise<CharacterExportResponse> {
    const character = await this.findOwnedActiveCharacter(currentUser, id);

    return this.exporter.export(
      character,
      this.parseRecord(character.metadataJson),
      this.parseExampleMessages(character.exampleMessagesJson)
    );
  }

  /**
   * 更新角色（部分更新）。
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @param dto 只有传入的字段会被更新，undefined 的字段保持原值。
   * @returns 更新后的角色响应。
   * @throws NotFoundException 角色不存在或不属于当前用户。
   * @throws BadRequestException 传了不存在的头像素材。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateCharacterDto
  ): Promise<CharacterResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    // 先校验角色存在且属于当前用户
    await this.findOwnedActiveCharacter(currentUser, id);
    // 头像：未传(undefined)不动，传 null/值则解析校验归属
    const avatarAssetId =
      dto.avatarAssetId === undefined
        ? undefined
        : await this.resolveAvatarAssetId(currentUser, dto.avatarAssetId);

    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // exampleMessages / metadata 传则整体替换
    const character = await this.prisma.character.update({
      where: { id },
      data: {
        ...(avatarAssetId === undefined ? {} : { avatarAssetId }),
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.personality === undefined ? {} : { personality: dto.personality }),
        ...(dto.scenario === undefined ? {} : { scenario: dto.scenario }),
        ...(dto.firstMessage === undefined ? {} : { firstMessage: dto.firstMessage }),
        ...(dto.exampleMessages === undefined
          ? {}
          : { exampleMessagesJson: this.stringifyNullable(dto.exampleMessages) }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) }),
        ...(dto.isSensitive === undefined ? {} : { isSensitive: dto.isSensitive }),
        ...(dto.isShared === undefined ? {} : { isShared: dto.isShared }),
        ...(dto.isArchived === undefined ? {} : { isArchived: dto.isArchived })
      },
      include: {
        avatarAsset: true
      }
    });

    if (dto.isSensitive !== undefined) {
      await this.refreshConversationSensitivityForCharacter(currentUser, id, dto.isSensitive);
    }

    return this.toResponse(character, currentUser);
  }

  /**
   * 删除角色（软删除：标记归档 + 设置删除时间，不真删记录）。
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 角色不存在或不属于当前用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveCharacter(currentUser, id);

    await this.prisma.character.update({
      where: { id },
      data: {
        isArchived: true,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  /**
   * 查询角色并校验所有权：限定 id + 当前用户 + 未删除。
   *
   * 防止越权访问或操作他人的角色；未找到时抛 404。
   *
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @returns 校验通过的角色记录（含头像）。
   * @throws NotFoundException 角色不存在/不属于该用户/已删除。
   */
  private async findOwnedActiveCharacter(
    currentUser: CurrentUser,
    id: string
  ): Promise<CharacterWithAvatar> {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
      },
      include: {
        avatarAsset: true
      }
    });

    if (!character) {
      throw new NotFoundException({
        code: ERROR_CODES.CHARACTER_NOT_FOUND,
        message: 'Character not found.'
      });
    }

    return character;
  }

  private async findVisibleActiveCharacter(
    currentUser: CurrentUser,
    id: string
  ): Promise<CharacterWithAvatar> {
    const owner = await this.contentLibraryService.getOwner();
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(currentUser.role === 'admin' || showSensitiveContent ? {} : { isSensitive: false }),
        ...(currentUser.role === 'admin'
          ? {}
          : { OR: [{ userId: currentUser.id }, { userId: owner.id, isShared: true }] })
      },
      include: { avatarAsset: true }
    });
    if (!character) {
      throw new NotFoundException({
        code: ERROR_CODES.CHARACTER_NOT_FOUND,
        message: 'Character not found.'
      });
    }
    return character;
  }

  private async findLibraryCharacter(
    currentUser: CurrentUser,
    id: string
  ): Promise<CharacterWithAvatar> {
    const owner = await this.contentLibraryService.getOwner();
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        userId: owner.id,
        isShared: true,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      },
      include: { avatarAsset: true }
    });
    if (!character) {
      throw new NotFoundException({
        code: ERROR_CODES.CONTENT_LIBRARY_ITEM_NOT_FOUND,
        message: 'Shared character not found.'
      });
    }
    return character;
  }

  /**
   * 校验头像素材并返回其 ID。
   * @param currentUser 当前登录用户。
   * @param avatarAssetId 传入的头像素材 ID；为空则不设头像。
   * @returns 校验通过的素材 ID，或 null（不设头像）。
   * @throws BadRequestException 素材不存在/不属于该用户/非头像类型。
   */
  private async resolveAvatarAssetId(
    currentUser: CurrentUser,
    avatarAssetId: string | null | undefined
  ): Promise<string | null> {
    // 未传头像：不设
    if (!avatarAssetId) {
      return null;
    }

    // 校验素材存在 + 属于当前用户 + 是头像类型
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: avatarAssetId,
        userId: currentUser.id,
        kind: CHARACTER_AVATAR_KIND,
        deletedAt: null
      }
    });

    if (!asset) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_NOT_FOUND,
        message: 'Avatar asset not found.'
      });
    }

    return asset.id;
  }

  /**
   * 生成导入预览：在映射字段基础上补充冲突检测和建议名。
   *
   * @param currentUser 当前登录用户。
   * @param mapped importer 已映射好的结构化字段。
   * @returns 含 nameConflict / suggestedName / warnings 的完整预览。
   */
  private async toImportPreview(
    currentUser: CurrentUser,
    mapped: Omit<CharacterImportPreview, 'nameConflict' | 'suggestedName'>
  ): Promise<CharacterImportPreview> {
    // 查是否已存在同名角色
    const existing = await this.prisma.character.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        name: mapped.name
      },
      select: {
        id: true
      }
    });
    const nameConflict = Boolean(existing);
    // 冲突时生成建议副本名（如「xxx 导入副本」）
    const suggestedName = nameConflict
      ? await this.createSuggestedImportName(currentUser, mapped.name)
      : null;

    return {
      ...mapped,
      // 冲突时追加 NAME_CONFLICT 警告，提示默认不会覆盖
      warnings: nameConflict
        ? [
            ...mapped.warnings,
            {
              code: 'NAME_CONFLICT',
              field: 'name',
              message: `已存在同名角色「${mapped.name}」，默认不会覆盖。`
            }
          ]
        : mapped.warnings,
      nameConflict,
      suggestedName
    };
  }

  /**
   * 生成不冲突的导入副本名。
   *
   * 基础名「{原名} 导入副本」，若已存在则追加序号（2、3…）直到不冲突。
   * 名字长度受 110/120 字符限制。
   * @param currentUser 当前登录用户。
   * @param name 原角色名。
   * @returns 不冲突的副本名。
   */
  private async createSuggestedImportName(currentUser: CurrentUser, name: string): Promise<string> {
    const baseName = `${name} 导入副本`.slice(0, 110);
    let candidate = baseName;
    let index = 2;

    // 候选名已存在就追加序号重试，直到找到不冲突的名字
    while (await this.characterNameExists(currentUser, candidate)) {
      candidate = `${baseName} ${index}`.slice(0, 120);
      index += 1;
    }

    return candidate;
  }

  /**
   * 判断当前用户是否已有指定名称的角色（未删除的）。
   * @param currentUser 当前登录用户。
   * @param name 角色名。
   * @returns 存在返回 true。
   */
  private async characterNameExists(currentUser: CurrentUser, name: string): Promise<boolean> {
    const character = await this.prisma.character.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        name
      },
      select: {
        id: true
      }
    });

    return Boolean(character);
  }

  /**
   * 数据库记录 → 对外响应（解析 JSON 字符串字段、补充头像 URL、格式化时间）。
   * @param character 角色记录（含头像）。
   * @returns 角色响应。
   */
  private toResponse(
    character: CharacterWithAvatar,
    currentUser: CurrentUser,
    ownerName: string | null = null
  ): CharacterResponse {
    const isOwner = character.userId === currentUser.id;
    return {
      id: character.id,
      userId: character.userId,
      avatarAssetId: character.avatarAssetId,
      avatarUrl: character.avatarAsset?.publicPath ?? null,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
      exampleMessages: this.parseExampleMessages(character.exampleMessagesJson),
      metadata: this.parseRecord(character.metadataJson),
      isSensitive: character.isSensitive,
      isShared: character.isShared,
      isOwner,
      ownerName,
      canFork: !isOwner && character.isShared,
      isArchived: character.isArchived,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString()
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

  /**
   * 解析 exampleMessagesJson 为数组；为空或解析失败返回空数组。
   * @param value exampleMessagesJson 字符串。
   * @returns 示例消息数组。
   */
  private parseExampleMessages(value: string | null): ExampleMessage[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;

        return (record.role === 'user' || record.role === 'assistant') &&
          typeof record.content === 'string'
          ? [{ role: record.role, content: record.content }]
          : [];
      });
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

  private async refreshConversationSensitivityForCharacter(
    currentUser: CurrentUser,
    characterId: string,
    isSensitive: boolean
  ): Promise<void> {
    if (isSensitive) {
      await this.prisma.conversation.updateMany({
        where: {
          userId: currentUser.id,
          characterId,
          deletedAt: null
        },
        data: {
          usesSensitiveResource: true
        }
      });
      return;
    }

    await this.prisma.conversation.updateMany({
      where: {
        userId: currentUser.id,
        characterId,
        deletedAt: null,
        character: {
          isSensitive: false
        },
        AND: [
          {
            OR: [{ promptPresetId: null }, { promptPreset: { is: { isSensitive: false } } }]
          },
          {
            OR: [{ personaId: null }, { persona: { is: { isSensitive: false } } }]
          }
        ]
      },
      data: {
        usesSensitiveResource: false
      }
    });
  }
}
