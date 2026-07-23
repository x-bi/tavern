import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createAvailableName } from '../../common/module-json-import';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { ContentLibraryService } from '../content-library/content-library.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUser } from '../users/user.types';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UpdateCompanionDto } from './dto/update-companion.dto';
import type {
  CompanionExportResponse,
  CompanionImportPreview,
  CompanionImportResponse,
  CompanionResponse
} from './companion.types';
import { QueryCompanionsDto } from './dto/query-companions.dto';
import type { ImportCompanionDto } from './dto/import-companion.dto';

/** 独立 AI 角色 CRUD；所有资源均按当前用户隔离。 */
@Injectable()
export class CompanionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetsService) private readonly assetsService: AssetsService,
    @Inject(ContentLibraryService) private readonly contentLibraryService: ContentLibraryService,
    @Inject(SettingsService) private readonly settingsService: SettingsService
  ) {}

  async list(currentUser: CurrentUser, query: QueryCompanionsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const access = await this.contentLibraryService.resolveAccess(currentUser, query.scope);
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const where = {
      ...(access.isManaged
        ? { userId: { not: currentUser.id } }
        : access.owner
          ? { userId: access.owner.id }
          : {}),
      deletedAt: null,
      ...(query.scope === 'library' ? { isShared: true } : {}),
      ...(access.isManaged || showSensitiveContent ? {} : { isSensitive: false }),
      ...(query.search?.trim() ? { name: { contains: query.search.trim() } } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companion.findMany({
        where,
        include: { avatarAsset: true, memory: true, runtimeState: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.companion.count({ where })
    ]);
    const ownerNames = access.isManaged
      ? await this.contentLibraryService.getOwnerNameMap(items.map((item) => item.userId))
      : null;
    return {
      items: items.map((item) =>
        this.toResponse(item, currentUser, ownerNames?.get(item.userId) ?? access.ownerName)
      ),
      total,
      page,
      pageSize
    };
  }

  async getById(currentUser: CurrentUser, id: string): Promise<CompanionResponse> {
    const item = await this.findVisible(currentUser, id);
    const owner =
      item.userId === currentUser.id ? null : await this.contentLibraryService.getOwner();
    return this.toResponse(item, currentUser, owner?.displayName ?? null);
  }

  async create(currentUser: CurrentUser, dto: CreateCompanionDto): Promise<CompanionResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    await this.assertReferences(currentUser, dto);
    const item = await this.prisma.companion.create({
      data: {
        userId: currentUser.id,
        name: dto.name.trim(),
        coreIdentity: dto.coreIdentity?.trim() ?? '',
        personality: dto.personality?.trim() ?? '',
        speechStyle: dto.speechStyle?.trim() ?? '',
        relationshipDefaults: dto.relationshipDefaults?.trim() ?? '',
        avatarAssetId: dto.avatarAssetId ?? null,
        modelFallbackGroupId: dto.modelFallbackGroupId ?? null,
        promptPresetId: dto.promptPresetId ?? null,
        personaId: dto.personaId ?? null,
        isSensitive: dto.isSensitive ?? false,
        isShared: dto.isShared ?? false,
        memory: { create: {} },
        runtimeState: { create: {} }
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });
    return this.toResponse(item, currentUser);
  }

  /** 导入 Companion JSON 或通用 chara_card_v2；用户专属配置不会从文件恢复。 */
  async importJson(
    currentUser: CurrentUser,
    dto: ImportCompanionDto
  ): Promise<CompanionImportResponse> {
    const preview = await this.toImportPreview(currentUser, this.parseImport(dto.rawJson));

    if (!dto.commit) {
      return { imported: false, preview, companion: null };
    }

    if (preview.nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: 'COMPANION_IMPORT_NAME_EXISTS',
        message: 'Companion name already exists. Choose rename to import a copy.'
      });
    }

    const item = await this.prisma.companion.create({
      data: {
        userId: currentUser.id,
        name: preview.nameConflict ? preview.suggestedName! : preview.name,
        coreIdentity: preview.coreIdentity,
        personality: preview.personality,
        speechStyle: preview.speechStyle,
        relationshipDefaults: preview.relationshipDefaults,
        isSensitive: false,
        isShared: false,
        memory: { create: {} },
        runtimeState: { create: {} }
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });

    return {
      imported: true,
      preview: { ...preview, name: item.name, nameConflict: false, suggestedName: null },
      companion: this.toResponse(item, currentUser)
    };
  }

  getImportTemplate() {
    return {
      fileName: 'tavern-lite-companion-template.json',
      template: {
        formatVersion: 'tavern-lite.companion.v2',
        name: '示例 AI 角色',
        coreIdentity: '温柔、真诚的长期陪伴者',
        personality: '克制而有耐心',
        speechStyle: '自然私聊',
        relationshipDefaults: ''
      }
    };
  }

  async exportJson(currentUser: CurrentUser, id: string): Promise<CompanionExportResponse> {
    const item = await this.findOwned(currentUser, id);
    const exportedAt = new Date().toISOString();

    return {
      fileName: `${this.toSafeFileName(item.name)}-companion.json`,
      card: {
        formatVersion: 'tavern-lite.companion.v2',
        name: item.name,
        coreIdentity: item.coreIdentity,
        personality: item.personality,
        speechStyle: item.speechStyle,
        relationshipDefaults: item.relationshipDefaults,
        exportedAt
      }
    };
  }

  /** 深复制 Companion 本身、头像、Persona、PromptPreset；不复制消息或记忆内容。 */
  async fork(currentUser: CurrentUser, id: string): Promise<CompanionResponse> {
    const source = await this.findLibrary(currentUser, id);
    const preparedAvatar = await this.assetsService.prepareCharacterAvatarCopy(
      source.userId,
      currentUser.id,
      source.avatarAssetId
    );
    const [presetNames, personaNames] = await Promise.all([
      this.prisma.promptPreset.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      }),
      this.prisma.userPersona.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      })
    ]);

    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const avatarAssetId = preparedAvatar
          ? (await tx.asset.create({ data: preparedAvatar.data })).id
          : null;
        const promptPresetId = source.promptPreset
          ? (
              await tx.promptPreset.create({
                data: {
                  userId: currentUser.id,
                  name: createAvailableName(
                    source.promptPreset.name,
                    new Set(presetNames.map((v) => v.name))
                  ),
                  description: source.promptPreset.description,
                  instructionsJson: source.promptPreset.instructionsJson,
                  outputRulesJson: source.promptPreset.outputRulesJson,
                  generationPurposesJson: source.promptPreset.generationPurposesJson,
                  parametersJson: source.promptPreset.parametersJson,
                  metadataJson: source.promptPreset.metadataJson,
                  isSensitive: source.promptPreset.isSensitive,
                  isShared: false,
                  isDefault: false
                }
              })
            ).id
          : null;
        const personaId = source.persona
          ? (
              await tx.userPersona.create({
                data: {
                  userId: currentUser.id,
                  name: createAvailableName(
                    source.persona.name,
                    new Set(personaNames.map((v) => v.name))
                  ),
                  coreIdentity: source.persona.coreIdentity,
                  background: source.persona.background,
                  interactionPreferences: source.persona.interactionPreferences,
                  metadataJson: source.persona.metadataJson,
                  isSensitive: source.persona.isSensitive,
                  isShared: false,
                  isDefault: false
                }
              })
            ).id
          : null;
        return tx.companion.create({
          data: {
            userId: currentUser.id,
            name: source.name,
            coreIdentity: source.coreIdentity,
            personality: source.personality,
            speechStyle: source.speechStyle,
            relationshipDefaults: source.relationshipDefaults,
            avatarAssetId,
            modelFallbackGroupId: source.modelFallbackGroupId,
            promptPresetId,
            personaId,
            isSensitive: source.isSensitive,
            isShared: false,
            memory: { create: {} },
            runtimeState: { create: {} }
          },
          include: { avatarAsset: true, memory: true, runtimeState: true }
        });
      });
      return this.toResponse(item, currentUser);
    } catch (error) {
      await this.assetsService.discardPreparedAvatarCopy(preparedAvatar);
      throw error;
    }
  }

  /** 复制当前用户自己的 Companion；保留配置引用，但不复制消息、记忆和分享。 */
  async duplicate(currentUser: CurrentUser, id: string): Promise<CompanionResponse> {
    const source = await this.findOwned(currentUser, id);
    const existingNames = new Set(
      (
        await this.prisma.companion.findMany({
          where: { userId: currentUser.id, deletedAt: null },
          select: { name: true }
        })
      ).map((item) => item.name)
    );
    const baseName = `${source.name.slice(0, 70)} 副本`;
    const name = existingNames.has(baseName)
      ? createAvailableName(baseName, existingNames)
      : baseName;
    const item = await this.prisma.companion.create({
      data: {
        userId: currentUser.id,
        name,
        coreIdentity: source.coreIdentity,
        personality: source.personality,
        speechStyle: source.speechStyle,
        relationshipDefaults: source.relationshipDefaults,
        avatarAssetId: source.avatarAssetId,
        modelFallbackGroupId: source.modelFallbackGroupId,
        promptPresetId: source.promptPresetId,
        personaId: source.personaId,
        isSensitive: source.isSensitive,
        isShared: false,
        memory: { create: {} },
        runtimeState: { create: {} }
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });
    return this.toResponse(item, currentUser);
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateCompanionDto
  ): Promise<CompanionResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    await this.findOwned(currentUser, id);
    await this.assertReferences(currentUser, dto);
    const item = await this.prisma.companion.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.coreIdentity === undefined ? {} : { coreIdentity: dto.coreIdentity.trim() }),
        ...(dto.personality === undefined ? {} : { personality: dto.personality.trim() }),
        ...(dto.speechStyle === undefined ? {} : { speechStyle: dto.speechStyle.trim() }),
        ...(dto.relationshipDefaults === undefined
          ? {}
          : { relationshipDefaults: dto.relationshipDefaults.trim() }),
        version: { increment: 1 },
        ...(dto.avatarAssetId === undefined ? {} : { avatarAssetId: dto.avatarAssetId }),
        ...(dto.modelFallbackGroupId === undefined
          ? {}
          : { modelFallbackGroupId: dto.modelFallbackGroupId }),
        ...(dto.promptPresetId === undefined ? {} : { promptPresetId: dto.promptPresetId }),
        ...(dto.personaId === undefined ? {} : { personaId: dto.personaId }),
        ...(dto.isSensitive === undefined ? {} : { isSensitive: dto.isSensitive }),
        ...(dto.isShared === undefined ? {} : { isShared: dto.isShared })
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });
    return this.toResponse(item, currentUser);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwned(currentUser, id);
    await this.prisma.companion.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, id };
  }

  async updateRuntimeState(
    currentUser: CurrentUser,
    id: string,
    dto: { currentMood?: string | null; currentSituation?: string | null }
  ) {
    await this.findOwned(currentUser, id);
    return this.prisma.$transaction(async (tx) => {
      const state = await tx.companionRuntimeState.upsert({
        where: { companionId: id },
        create: {
          companionId: id,
          currentMood: dto.currentMood?.trim() || null,
          currentSituation: dto.currentSituation?.trim() || null,
          version: 1
        },
        update: {
          ...(dto.currentMood === undefined
            ? {}
            : { currentMood: dto.currentMood?.trim() || null }),
          ...(dto.currentSituation === undefined
            ? {}
            : { currentSituation: dto.currentSituation?.trim() || null }),
          version: { increment: 1 }
        }
      });
      await tx.companion.update({ where: { id }, data: { version: { increment: 1 } } });
      return {
        ...state,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString()
      };
    });
  }

  private async findOwned(currentUser: CurrentUser, id: string) {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const item = await this.prisma.companion.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });
    if (!item)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
    return item;
  }

  private async findVisible(currentUser: CurrentUser, id: string) {
    const owner = await this.contentLibraryService.getOwner();
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const item = await this.prisma.companion.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false }),
        OR: [{ userId: currentUser.id }, { userId: owner.id, isShared: true }]
      },
      include: { avatarAsset: true, memory: true, runtimeState: true }
    });
    if (!item)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
    return item;
  }

  private async findLibrary(currentUser: CurrentUser, id: string) {
    const owner = await this.contentLibraryService.getOwner();
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const item = await this.prisma.companion.findFirst({
      where: {
        id,
        userId: owner.id,
        isShared: true,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
      },
      include: {
        avatarAsset: true,
        memory: true,
        runtimeState: true,
        promptPreset: true,
        persona: true
      }
    });
    if (!item)
      throw new NotFoundException({
        code: 'CONTENT_LIBRARY_ITEM_NOT_FOUND',
        message: 'Shared companion not found.'
      });
    return item;
  }

  private async assertReferences(
    currentUser: CurrentUser,
    dto: Partial<CreateCompanionDto>
  ): Promise<void> {
    const checks = await Promise.all([
      dto.avatarAssetId
        ? this.prisma.asset.findFirst({
            where: { id: dto.avatarAssetId, userId: currentUser.id, deletedAt: null }
          })
        : true,
      dto.modelFallbackGroupId
        ? this.prisma.modelFallbackGroup.findFirst({
            where: { id: dto.modelFallbackGroupId, deletedAt: null }
          })
        : true,
      dto.promptPresetId
        ? this.prisma.promptPreset.findFirst({
            where: { id: dto.promptPresetId, userId: currentUser.id, deletedAt: null }
          })
        : true,
      dto.personaId
        ? this.prisma.userPersona.findFirst({
            where: { id: dto.personaId, userId: currentUser.id, deletedAt: null }
          })
        : true
    ]);
    if (checks.some((value) => value !== true && !value))
      throw new NotFoundException({
        code: 'COMPANION_REFERENCE_NOT_FOUND',
        message: 'Companion reference not found.'
      });
  }

  private async toImportPreview(
    currentUser: CurrentUser,
    parsed: Omit<CompanionImportPreview, 'nameConflict' | 'suggestedName'>
  ): Promise<CompanionImportPreview> {
    const existing = await this.prisma.companion.findFirst({
      where: { userId: currentUser.id, name: parsed.name, deletedAt: null },
      select: { id: true }
    });

    return {
      ...parsed,
      nameConflict: Boolean(existing),
      suggestedName: existing ? `${parsed.name}（导入）` : null
    };
  }

  private parseImport(
    rawJson: string
  ): Omit<CompanionImportPreview, 'nameConflict' | 'suggestedName'> {
    let root: Record<string, unknown>;

    try {
      const value: unknown = JSON.parse(rawJson);

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Companion import root must be an object.');
      }

      root = value as Record<string, unknown>;
    } catch {
      throw new BadRequestException({
        code: 'COMPANION_IMPORT_INVALID_JSON',
        message: 'Companion import must be a JSON object.'
      });
    }

    if (root.formatVersion === 'tavern-lite.companion.v2') {
      return {
        format: 'tavern-lite.companion.v2',
        name: this.requiredText(root.name, 'name'),
        coreIdentity: this.optionalText(root.coreIdentity),
        personality: this.optionalText(root.personality),
        speechStyle: this.optionalText(root.speechStyle),
        relationshipDefaults: this.optionalText(root.relationshipDefaults),
        warnings: ['模型链、Persona、头像和记忆设置不会从导入文件恢复。']
      };
    }

    if (root.spec !== 'chara_card_v2') {
      throw new BadRequestException({
        code: 'COMPANION_IMPORT_INVALID_FORMAT',
        message: 'Companion import only accepts tavern-lite.companion.v2 or chara_card_v2.'
      });
    }

    const data = this.asRecord(root.data);
    if (!data) {
      throw new BadRequestException({
        code: 'COMPANION_IMPORT_INVALID_FORMAT',
        message: 'chara_card_v2 import requires an object data field.'
      });
    }
    const description = this.optionalText(data.description);
    const personality = this.optionalText(data.personality);
    const scenario = this.optionalText(data.scenario);
    const systemPrompt = this.optionalText(data.system_prompt);

    return {
      format: 'chara_card_v2',
      name: this.requiredText(data.name, 'name'),
      coreIdentity: description,
      personality,
      speechStyle: systemPrompt,
      relationshipDefaults: scenario,
      warnings: ['已映射通用角色卡字段；开场白和示例对话不会写入 Companion 的长期关系线程。']
    };
  }

  private requiredText(value: unknown, field: string) {
    const text = this.optionalText(value);

    if (!text) {
      throw new BadRequestException({
        code: 'COMPANION_IMPORT_INVALID_FORMAT',
        message: `Companion import requires a non-empty ${field}.`
      });
    }

    return text.slice(0, 80);
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 12_000) : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toSafeFileName(name: string) {
    return (
      name
        .trim()
        .replace(/[<>:"/\\|?*]/g, '-')
        .split('')
        .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
        .join('')
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'companion'
    );
  }

  private toResponse(
    item: Prisma.CompanionGetPayload<{
      include: { avatarAsset: true; memory: true; runtimeState: true };
    }>,
    currentUser: CurrentUser,
    ownerName: string | null = null
  ): CompanionResponse {
    const isOwner = item.userId === currentUser.id;
    return {
      id: item.id,
      userId: item.userId,
      name: item.name,
      coreIdentity: item.coreIdentity,
      personality: item.personality,
      speechStyle: item.speechStyle,
      relationshipDefaults: item.relationshipDefaults,
      avatarAssetId: item.avatarAssetId,
      avatarUrl: item.avatarAsset?.publicPath ?? null,
      modelFallbackGroupId: item.modelFallbackGroupId,
      promptPresetId: item.promptPresetId,
      personaId: item.personaId,
      memoryEnabled: item.memory?.isEnabled ?? false,
      memoryPaused: item.memory?.isPaused ?? false,
      runtimeState: item.runtimeState
        ? {
            currentMood: item.runtimeState.currentMood,
            currentSituation: item.runtimeState.currentSituation,
            version: item.runtimeState.version,
            createdAt: item.runtimeState.createdAt.toISOString(),
            updatedAt: item.runtimeState.updatedAt.toISOString()
          }
        : null,
      isSensitive: item.isSensitive,
      isShared: item.isShared,
      isOwner,
      ownerName,
      canFork: !isOwner && item.isShared,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }
}
