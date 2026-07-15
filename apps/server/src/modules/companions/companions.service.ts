import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: CurrentUser, query: QueryCompanionsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.search?.trim() ? { name: { contains: query.search.trim() } } : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companion.findMany({
        where,
        include: { avatarAsset: true, memory: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.companion.count({ where })
    ]);
    return { items: items.map((item) => this.toResponse(item)), total, page, pageSize };
  }

  async getById(currentUser: CurrentUser, id: string): Promise<CompanionResponse> {
    return this.toResponse(await this.findOwned(currentUser, id));
  }

  async create(currentUser: CurrentUser, dto: CreateCompanionDto): Promise<CompanionResponse> {
    await this.assertReferences(currentUser, dto);
    const item = await this.prisma.companion.create({
      data: {
        userId: currentUser.id,
        name: dto.name.trim(),
        identityPrompt: dto.identityPrompt?.trim() ?? '',
        avatarAssetId: dto.avatarAssetId ?? null,
        modelFallbackGroupId: dto.modelFallbackGroupId ?? null,
        promptPresetId: dto.promptPresetId ?? null,
        personaId: dto.personaId ?? null,
        memory: { create: {} }
      },
      include: { avatarAsset: true, memory: true }
    });
    return this.toResponse(item);
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
        identityPrompt: preview.identityPrompt,
        memory: { create: {} }
      },
      include: { avatarAsset: true, memory: true }
    });

    return {
      imported: true,
      preview: { ...preview, name: item.name, nameConflict: false, suggestedName: null },
      companion: this.toResponse(item)
    };
  }

  getImportTemplate() {
    return {
      fileName: 'tavern-lite-companion-template.json',
      template: {
        formatVersion: 'tavern-lite.companion.v1',
        name: '示例 AI 角色',
        identityPrompt: '你是一位温柔、真诚的 AI 陪伴角色。请用自然简短的中文和用户交流。'
      }
    };
  }

  async exportJson(currentUser: CurrentUser, id: string): Promise<CompanionExportResponse> {
    const item = await this.findOwned(currentUser, id);
    const exportedAt = new Date().toISOString();

    return {
      fileName: `${this.toSafeFileName(item.name)}-companion.json`,
      card: {
        formatVersion: 'tavern-lite.companion.v1',
        name: item.name,
        identityPrompt: item.identityPrompt,
        exportedAt
      }
    };
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateCompanionDto
  ): Promise<CompanionResponse> {
    await this.findOwned(currentUser, id);
    await this.assertReferences(currentUser, dto);
    const item = await this.prisma.companion.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.identityPrompt === undefined ? {} : { identityPrompt: dto.identityPrompt.trim() }),
        ...(dto.avatarAssetId === undefined ? {} : { avatarAssetId: dto.avatarAssetId }),
        ...(dto.modelFallbackGroupId === undefined
          ? {}
          : { modelFallbackGroupId: dto.modelFallbackGroupId }),
        ...(dto.promptPresetId === undefined ? {} : { promptPresetId: dto.promptPresetId }),
        ...(dto.personaId === undefined ? {} : { personaId: dto.personaId })
      },
      include: { avatarAsset: true, memory: true }
    });
    return this.toResponse(item);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwned(currentUser, id);
    await this.prisma.companion.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, id };
  }

  private async findOwned(currentUser: CurrentUser, id: string) {
    const item = await this.prisma.companion.findFirst({
      where: { id, userId: currentUser.id, deletedAt: null },
      include: { avatarAsset: true, memory: true }
    });
    if (!item)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
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
            where: { id: dto.modelFallbackGroupId, userId: currentUser.id, deletedAt: null }
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

    if (root.formatVersion === 'tavern-lite.companion.v1') {
      return {
        format: 'tavern-lite.companion.v1',
        name: this.requiredText(root.name, 'name'),
        identityPrompt: this.optionalText(root.identityPrompt),
        warnings: ['模型链、Persona、头像和记忆设置不会从导入文件恢复。']
      };
    }

    const data = this.asRecord(root.data) ?? root;
    const description = this.optionalText(data.description);
    const personality = this.optionalText(data.personality);
    const scenario = this.optionalText(data.scenario);
    const systemPrompt = this.optionalText(data.system_prompt);
    const identityPrompt = [
      description && `角色描述：${description}`,
      personality && `性格：${personality}`,
      scenario && `场景：${scenario}`,
      systemPrompt && `补充规则：${systemPrompt}`
    ]
      .filter((item): item is string => Boolean(item))
      .join('\n\n');

    return {
      format: root.spec === 'chara_card_v2' ? 'chara_card_v2' : 'generic-json',
      name: this.requiredText(data.name, 'name'),
      identityPrompt,
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
    item: Prisma.CompanionGetPayload<{ include: { avatarAsset: true; memory: true } }>
  ): CompanionResponse {
    return {
      id: item.id,
      userId: item.userId,
      name: item.name,
      identityPrompt: item.identityPrompt,
      avatarAssetId: item.avatarAssetId,
      avatarUrl: item.avatarAsset?.publicPath ?? null,
      modelFallbackGroupId: item.modelFallbackGroupId,
      promptPresetId: item.promptPresetId,
      personaId: item.personaId,
      memoryEnabled: item.memory?.isEnabled ?? false,
      memoryPaused: item.memory?.isPaused ?? false,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }
}
