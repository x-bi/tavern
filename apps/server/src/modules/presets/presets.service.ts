import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PromptPreset } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { CreatePromptPresetDto } from './dto/create-prompt-preset.dto';
import type { QueryPromptPresetsDto } from './dto/query-prompt-presets.dto';
import type { UpdatePromptPresetDto } from './dto/update-prompt-preset.dto';
import type {
  PromptPresetListResponse,
  PromptPresetParams,
  PromptPresetResponse
} from './prompt-preset.types';

@Injectable()
export class PresetsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async list(
    currentUser: CurrentUser,
    query: QueryPromptPresetsDto
  ): Promise<PromptPresetListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isDefault === undefined ? {} : { isDefault: query.isDefault }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
              { outputRules: { contains: query.search } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.promptPreset.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.promptPreset.count({ where })
    ]);

    return {
      items: items.map((preset) => this.toResponse(preset)),
      total,
      page,
      pageSize
    };
  }

  async create(
    currentUser: CurrentUser,
    dto: CreatePromptPresetDto
  ): Promise<PromptPresetResponse> {
    const data = {
      userId: currentUser.id,
      name: dto.name,
      description: dto.description ?? '',
      outputRules: dto.outputRules ?? '',
      parametersJson: this.stringifyParams(this.pickParams(dto)),
      isDefault: dto.isDefault ?? false
    };

    try {
      const preset = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.promptPreset.updateMany({
              where: {
                userId: currentUser.id,
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.promptPreset.create({ data });
          })
        : await this.prisma.promptPreset.create({ data });

      return this.toResponse(preset);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdatePromptPresetDto
  ): Promise<PromptPresetResponse> {
    const existing = await this.findOwnedActivePromptPreset(currentUser, id);
    const params = this.mergeParams(this.parseParams(existing.parametersJson), dto);
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(dto.outputRules === undefined ? {} : { outputRules: dto.outputRules }),
      ...(this.hasParamUpdate(dto) ? { parametersJson: this.stringifyParams(params) } : {}),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
    };

    try {
      const preset = dto.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.promptPreset.updateMany({
              where: {
                userId: currentUser.id,
                id: {
                  not: id
                },
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.promptPreset.update({
              where: { id },
              data
            });
          })
        : await this.prisma.promptPreset.update({
            where: { id },
            data
          });

      return this.toResponse(preset);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActivePromptPreset(currentUser, id);

    await this.prisma.promptPreset.update({
      where: { id },
      data: {
        name: `${existing.name}__deleted__${existing.id}`,
        isDefault: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  private async findOwnedActivePromptPreset(
    currentUser: CurrentUser,
    id: string
  ): Promise<PromptPreset> {
    const preset = await this.prisma.promptPreset.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      }
    });

    if (!preset) {
      throw new NotFoundException({
        code: ERROR_CODES.PROMPT_PRESET_NOT_FOUND,
        message: 'Prompt preset not found.'
      });
    }

    return preset;
  }

  private toResponse(preset: PromptPreset): PromptPresetResponse {
    const params = this.parseParams(preset.parametersJson);

    return {
      id: preset.id,
      userId: preset.userId,
      name: preset.name,
      description: preset.description,
      outputRules: preset.outputRules,
      temperature: params.temperature ?? null,
      topP: params.topP ?? null,
      maxTokens: params.maxTokens ?? null,
      isDefault: preset.isDefault,
      createdAt: preset.createdAt.toISOString(),
      updatedAt: preset.updatedAt.toISOString()
    };
  }

  private pickParams(dto: CreatePromptPresetDto): PromptPresetParams {
    return this.mergeParams({}, dto);
  }

  private mergeParams(
    existing: PromptPresetParams,
    dto: Partial<CreatePromptPresetDto | UpdatePromptPresetDto>
  ): PromptPresetParams {
    return {
      ...(existing.temperature === undefined ? {} : { temperature: existing.temperature }),
      ...(existing.topP === undefined ? {} : { topP: existing.topP }),
      ...(existing.maxTokens === undefined ? {} : { maxTokens: existing.maxTokens }),
      ...(dto.temperature === undefined ? {} : { temperature: dto.temperature }),
      ...(dto.topP === undefined ? {} : { topP: dto.topP }),
      ...(dto.maxTokens === undefined ? {} : { maxTokens: dto.maxTokens })
    };
  }

  private hasParamUpdate(dto: UpdatePromptPresetDto): boolean {
    return dto.temperature !== undefined || dto.topP !== undefined || dto.maxTokens !== undefined;
  }

  private stringifyParams(params: PromptPresetParams): string | null {
    return Object.keys(params).length > 0 ? JSON.stringify(params) : null;
  }

  private parseParams(value: string | null): PromptPresetParams {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Partial<PromptPresetParams>;

      return {
        ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
        ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
        ...(Number.isInteger(parsed.maxTokens) ? { maxTokens: parsed.maxTokens } : {})
      };
    } catch {
      return {};
    }
  }

  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.PROMPT_PRESET_NAME_EXISTS,
        message: 'Prompt preset name already exists.'
      });
    }
  }
}
