import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type ModelFallbackCandidate,
  type ModelFallbackGroup,
  type ModelProvider,
  type ProviderModel
} from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelGatewayService } from '../../services/model-gateway';
import type { CurrentUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import type { CreateModelFallbackGroupDto } from './dto/create-model-fallback-group.dto';
import type { CreateModelProviderDto } from './dto/create-model-provider.dto';
import type { CreateProviderModelDto } from './dto/create-provider-model.dto';
import type { QueryModelResourcesDto } from './dto/query-model-resources.dto';
import type { UpdateModelFallbackGroupDto } from './dto/update-model-fallback-group.dto';
import type { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import type { UpdateProviderModelDto } from './dto/update-provider-model.dto';
import type {
  ModelFallbackCandidateResponse,
  ModelFallbackGroupResponse,
  ModelConnectionTestResponse,
  ModelGenerationParams,
  ModelGatewayConfig,
  ModelProviderResponse,
  ProviderModelResponse
} from './model.types';

type ProviderModelWithProvider = ProviderModel & {
  provider: ModelProvider;
};

type FallbackCandidateWithModel = ModelFallbackCandidate & {
  model: ProviderModelWithProvider;
};

type FallbackGroupWithCandidates = ModelFallbackGroup & {
  candidates: FallbackCandidateWithModel[];
};

/**
 * 模型服务：管理模型供应商、供应商模型、模型链（回退组）的 CRUD、API Key 加解密、连接测试。
 *
 * 设计要点：
 * - API Key 用 AES-256-GCM 加密存储，密钥由 AUTH_TOKEN_SECRET 派生（SHA-256）；
 * - 每个 isDefault=true 的资源在事务内保证用户范围内默认唯一（先取消旧默认）；
 * - 软删除时改名（加 __deleted__ 后缀）以释放唯一名约束；
 * - 所有查询按 userId 隔离。
 */
@Injectable()
export class ModelsService {
  /** API Key 加密密钥（由 AUTH_TOKEN_SECRET 的 SHA-256 派生，32 字节）。 */
  private readonly apiKeyEncryptionKey: Buffer;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(ModelGatewayService)
    private readonly modelGateway: ModelGatewayService,
    @Inject(UsersService)
    private readonly usersService: UsersService
  ) {
    this.apiKeyEncryptionKey = createHash('sha256')
      .update(this.configService.getOrThrow<string>('AUTH_TOKEN_SECRET'))
      .digest();
  }

  /** 当前 Gateway 已注册的规范供应商名，作为页面选项与保存校验的共同来源。 */
  listSupportedProviderNames(): { items: string[] } {
    return { items: this.modelGateway.getSupportedProviderNames() };
  }

  async listProviders(
    currentUser: CurrentUser,
    query: QueryModelResourcesDto
  ): Promise<{ items: ModelProviderResponse[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ModelProviderWhereInput = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { provider: { contains: query.search } },
              { baseUrl: { contains: query.search } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.modelProvider.findMany({
        where,
        include: {
          _count: {
            select: {
              models: {
                where: {
                  deletedAt: null
                }
              }
            }
          }
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.modelProvider.count({ where })
    ]);

    return {
      items: items.map((provider) => this.toProviderResponse(provider, provider._count.models)),
      total,
      page,
      pageSize
    };
  }

  async createProvider(
    currentUser: CurrentUser,
    dto: CreateModelProviderDto
  ): Promise<ModelProviderResponse> {
    this.assertSupportedProviderName(dto.providerName);
    const apiKey = this.normalizeApiKey(dto.apiKey);
    const data = {
      userId: currentUser.id,
      name: dto.name,
      provider: dto.providerName,
      baseUrl: dto.baseUrl,
      apiKeyCiphertext: this.encryptApiKey(apiKey),
      apiKeyMask: this.maskApiKey(apiKey),
      timeout: dto.timeout ?? null,
      isDefault: dto.isDefault ?? false,
      isEnabled: dto.isEnabled ?? true
    };

    try {
      const provider = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.modelProvider.updateMany({
              where: {
                userId: currentUser.id,
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.modelProvider.create({ data });
          })
        : await this.prisma.modelProvider.create({ data });

      return this.toProviderResponse(provider, 0);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async updateProvider(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateModelProviderDto
  ): Promise<ModelProviderResponse> {
    await this.findOwnedActiveProvider(currentUser, id);
    if (dto.providerName !== undefined) this.assertSupportedProviderName(dto.providerName);
    const apiKey = dto.apiKey === undefined ? undefined : this.normalizeApiKey(dto.apiKey);
    const data: Prisma.ModelProviderUpdateInput = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.providerName === undefined ? {} : { provider: dto.providerName }),
      ...(dto.baseUrl === undefined ? {} : { baseUrl: dto.baseUrl }),
      ...(apiKey === undefined
        ? {}
        : {
            apiKeyCiphertext: this.encryptApiKey(apiKey),
            apiKeyMask: this.maskApiKey(apiKey)
          }),
      ...(dto.timeout === undefined ? {} : { timeout: dto.timeout }),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }),
      ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled })
    };

    try {
      const provider = dto.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.modelProvider.updateMany({
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

            return tx.modelProvider.update({
              where: { id },
              data,
              include: {
                _count: {
                  select: {
                    models: {
                      where: {
                        deletedAt: null
                      }
                    }
                  }
                }
              }
            });
          })
        : await this.prisma.modelProvider.update({
            where: { id },
            data,
            include: {
              _count: {
                select: {
                  models: {
                    where: {
                      deletedAt: null
                    }
                  }
                }
              }
            }
          });

      return this.toProviderResponse(provider, provider._count.models);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async removeProvider(
    currentUser: CurrentUser,
    id: string
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActiveProvider(currentUser, id);

    await this.prisma.modelProvider.update({
      where: { id },
      data: {
        name: `${existing.name}__deleted__${existing.id}`,
        isDefault: false,
        isEnabled: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  async listProviderModels(
    currentUser: CurrentUser,
    query: QueryModelResourcesDto,
    providerId?: string
  ): Promise<{ items: ProviderModelResponse[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const where: Prisma.ProviderModelWhereInput = {
      deletedAt: null,
      provider: {
        userId: currentUser.id,
        deletedAt: null,
        ...(providerId ? { id: providerId } : {})
      },
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { model: { contains: query.search } }]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerModel.findMany({
        where,
        include: {
          provider: true
        },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.providerModel.count({ where })
    ]);

    return {
      items: items.map((model) => this.toProviderModelResponse(model)),
      total,
      page,
      pageSize
    };
  }

  async createProviderModel(
    currentUser: CurrentUser,
    dto: CreateProviderModelDto
  ): Promise<ProviderModelResponse> {
    await this.findOwnedActiveProvider(currentUser, dto.providerId);

    try {
      const model = await this.prisma.providerModel.create({
        data: {
          providerId: dto.providerId,
          name: dto.name,
          model: dto.modelName,
          defaultParamsJson: this.stringifyParams(this.pickProviderModelParams(dto)),
          contextLength: dto.contextLength ?? null,
          supportsDeveloperRole: dto.supportsDeveloperRole ?? false,
          systemPlacement: dto.systemPlacement ?? 'initial_only',
          supportsMultipleSystemMessages: dto.supportsMultipleSystemMessages ?? false,
          requiresAlternatingRoles: dto.requiresAlternatingRoles ?? true,
          tokenizerType: dto.tokenizerType ?? 'estimated_chars_v1',
          notes: dto.notes ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isEnabled: dto.isEnabled ?? true
        },
        include: {
          provider: true
        }
      });

      return this.toProviderModelResponse(model);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async updateProviderModel(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateProviderModelDto
  ): Promise<ProviderModelResponse> {
    const existing = await this.findOwnedActiveProviderModel(currentUser, id);
    const providerId = dto.providerId ?? existing.providerId;
    await this.findOwnedActiveProvider(currentUser, providerId);
    const params = this.mergeProviderModelParams(this.parseParams(existing.defaultParamsJson), dto);

    try {
      const model = await this.prisma.providerModel.update({
        where: { id },
        data: {
          ...(dto.providerId === undefined ? {} : { providerId }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.modelName === undefined ? {} : { model: dto.modelName }),
          ...(this.hasProviderModelParamUpdate(dto)
            ? { defaultParamsJson: this.stringifyParams(params) }
            : {}),
          ...(dto.contextLength === undefined ? {} : { contextLength: dto.contextLength }),
          ...(dto.supportsDeveloperRole === undefined
            ? {}
            : { supportsDeveloperRole: dto.supportsDeveloperRole }),
          ...(dto.systemPlacement === undefined ? {} : { systemPlacement: dto.systemPlacement }),
          ...(dto.supportsMultipleSystemMessages === undefined
            ? {}
            : { supportsMultipleSystemMessages: dto.supportsMultipleSystemMessages }),
          ...(dto.requiresAlternatingRoles === undefined
            ? {}
            : { requiresAlternatingRoles: dto.requiresAlternatingRoles }),
          ...(dto.tokenizerType === undefined ? {} : { tokenizerType: dto.tokenizerType }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
          ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled })
        },
        include: {
          provider: true
        }
      });

      return this.toProviderModelResponse(model);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async removeProviderModel(
    currentUser: CurrentUser,
    id: string
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActiveProviderModel(currentUser, id);

    await this.prisma.providerModel.update({
      where: { id },
      data: {
        name: `${existing.name}__deleted__${existing.id}`,
        model: `${existing.model}__deleted__${existing.id}`,
        isEnabled: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  async listFallbackGroups(
    currentUser: CurrentUser,
    query: QueryModelResourcesDto
  ): Promise<{
    items: ModelFallbackGroupResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const where: Prisma.ModelFallbackGroupWhereInput = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      ...(query.search ? { name: { contains: query.search } } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.modelFallbackGroup.findMany({
        where,
        include: this.fallbackGroupInclude(),
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.modelFallbackGroup.count({ where })
    ]);

    return {
      items: items.map((group) => this.toFallbackGroupResponse(group)),
      total,
      page,
      pageSize
    };
  }

  async createFallbackGroup(
    currentUser: CurrentUser,
    dto: CreateModelFallbackGroupDto
  ): Promise<ModelFallbackGroupResponse> {
    await this.assertFallbackCandidatesOwned(currentUser, dto.candidates);

    try {
      const group = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.modelFallbackGroup.updateMany({
            where: {
              userId: currentUser.id,
              deletedAt: null,
              isDefault: true
            },
            data: {
              isDefault: false
            }
          });
        }

        return tx.modelFallbackGroup.create({
          data: {
            userId: currentUser.id,
            name: dto.name,
            isDefault: dto.isDefault ?? false,
            isEnabled: dto.isEnabled ?? true,
            candidates: {
              create: dto.candidates.map((candidate) => ({
                modelId: candidate.modelId,
                priority: candidate.priority,
                isEnabled: candidate.isEnabled ?? true
              }))
            }
          },
          include: this.fallbackGroupInclude()
        });
      });

      return this.toFallbackGroupResponse(group);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async updateFallbackGroup(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateModelFallbackGroupDto
  ): Promise<ModelFallbackGroupResponse> {
    await this.findOwnedActiveFallbackGroup(currentUser, id);
    if (dto.candidates) {
      await this.assertFallbackCandidatesOwned(currentUser, dto.candidates);
    }

    try {
      const group = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.modelFallbackGroup.updateMany({
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
        }

        return tx.modelFallbackGroup.update({
          where: { id },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }),
            ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
            ...(dto.candidates === undefined
              ? {}
              : {
                  candidates: {
                    deleteMany: {},
                    create: dto.candidates.map((candidate) => ({
                      modelId: candidate.modelId,
                      priority: candidate.priority,
                      isEnabled: candidate.isEnabled ?? true
                    }))
                  }
                })
          },
          include: this.fallbackGroupInclude()
        });
      });

      return this.toFallbackGroupResponse(group);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async removeFallbackGroup(
    currentUser: CurrentUser,
    id: string
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActiveFallbackGroup(currentUser, id);

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model fallback group not found.'
      });
    }

    await this.prisma.modelFallbackGroup.update({
      where: { id },
      data: {
        name: `${existing.name}__deleted__${existing.id}`,
        isDefault: false,
        isEnabled: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  async testProviderModel(
    currentUser: CurrentUser,
    id: string
  ): Promise<ModelConnectionTestResponse> {
    const model = await this.findOwnedActiveProviderModel(currentUser, id);

    return this.modelGateway.testConnection({
      ...this.toGatewayConfigFromProviderModel(model, null),
      requestSource: 'connection_test'
    });
  }

  /**
   * 取模型链网关候选：按模型链（回退组）解析出有序的可调用候选。
   *
   * 无回退组或候选全部不可用时返回空数组，由调用方决定如何提示用户。
   * @param params 当前用户 + 可选的回退组 ID（未传则取默认启用的回退组）。
   * @returns 候选配置数组，按 priority 升序。
   */
  async getGatewayCandidates(params: {
    currentUser: CurrentUser;
    modelFallbackGroupId?: string | null;
  }): Promise<ModelGatewayConfig[]> {
    const sharedModelOwner = await this.usersService.getSharedModelOwner();
    const group =
      params.modelFallbackGroupId === undefined
        ? await this.findDefaultActiveFallbackGroup(sharedModelOwner)
        : await this.findOwnedActiveFallbackGroup(sharedModelOwner, params.modelFallbackGroupId);

    if (!group) {
      return [];
    }

    const candidates = group.candidates
      .filter(
        (candidate) =>
          candidate.isEnabled &&
          candidate.model.isEnabled &&
          !candidate.model.deletedAt &&
          candidate.model.provider.isEnabled &&
          !candidate.model.provider.deletedAt
      )
      .sort((left, right) => left.priority - right.priority);

    return candidates.map((candidate) =>
      this.toGatewayConfigFromProviderModel(candidate.model, group.id)
    );
  }

  private async findOwnedActiveProvider(
    currentUser: CurrentUser,
    id: string
  ): Promise<ModelProvider> {
    const provider = await this.prisma.modelProvider.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      }
    });

    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model provider not found.'
      });
    }

    return provider;
  }

  private async findOwnedActiveProviderModel(
    currentUser: CurrentUser,
    id: string
  ): Promise<ProviderModelWithProvider> {
    const model = await this.prisma.providerModel.findFirst({
      where: {
        id,
        deletedAt: null,
        provider: {
          userId: currentUser.id,
          deletedAt: null
        }
      },
      include: {
        provider: true
      }
    });

    if (!model) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Provider model not found.'
      });
    }

    return model;
  }

  private async findOwnedActiveFallbackGroup(
    currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<FallbackGroupWithCandidates | null> {
    if (!id) {
      return null;
    }

    const group = await this.prisma.modelFallbackGroup.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      include: this.fallbackGroupInclude()
    });

    if (!group) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model fallback group not found.'
      });
    }

    return group;
  }

  private async findDefaultActiveFallbackGroup(
    currentUser: CurrentUser
  ): Promise<FallbackGroupWithCandidates | null> {
    return this.prisma.modelFallbackGroup.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        isEnabled: true
      },
      include: this.fallbackGroupInclude(),
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  private async assertFallbackCandidatesOwned(
    currentUser: CurrentUser,
    candidates: { modelId: string; priority: number }[]
  ): Promise<void> {
    const modelIds = candidates.map((candidate) => candidate.modelId);
    const priorities = candidates.map((candidate) => candidate.priority);

    if (new Set(modelIds).size !== modelIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Model fallback candidates must not contain duplicate models.'
      });
    }

    if (new Set(priorities).size !== priorities.length) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Model fallback candidates must not contain duplicate priorities.'
      });
    }

    const count = await this.prisma.providerModel.count({
      where: {
        id: {
          in: modelIds
        },
        deletedAt: null,
        provider: {
          userId: currentUser.id,
          deletedAt: null
        }
      }
    });

    if (count !== modelIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'One or more fallback models were not found.'
      });
    }
  }

  private fallbackGroupInclude() {
    return {
      candidates: {
        include: {
          model: {
            include: {
              provider: true
            }
          }
        },
        orderBy: {
          priority: 'asc'
        }
      }
    } satisfies Prisma.ModelFallbackGroupInclude;
  }

  private toProviderResponse(provider: ModelProvider, modelCount: number): ModelProviderResponse {
    return {
      id: provider.id,
      userId: provider.userId,
      name: provider.name,
      providerName: provider.provider,
      baseUrl: provider.baseUrl,
      apiKeyMask: provider.apiKeyMask,
      hasApiKey: Boolean(provider.apiKeyCiphertext),
      timeout: provider.timeout,
      isDefault: provider.isDefault,
      isEnabled: provider.isEnabled,
      modelCount,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString()
    };
  }

  private toProviderModelResponse(model: ProviderModelWithProvider): ProviderModelResponse {
    const params = this.parseParams(model.defaultParamsJson);

    return {
      id: model.id,
      providerId: model.providerId,
      providerName: model.provider.provider,
      providerDisplayName: model.provider.name,
      name: model.name,
      modelName: model.model,
      temperature: params.temperature ?? null,
      topP: params.topP ?? null,
      maxTokens: params.maxTokens ?? null,
      timeout: params.timeout ?? null,
      effectiveTimeout: params.timeout ?? model.provider.timeout ?? null,
      frequencyPenalty: params.frequencyPenalty ?? null,
      presencePenalty: params.presencePenalty ?? null,
      contextLength: model.contextLength,
      supportsDeveloperRole: model.supportsDeveloperRole,
      systemPlacement: model.systemPlacement as 'initial_only' | 'midstream_allowed',
      supportsMultipleSystemMessages: model.supportsMultipleSystemMessages,
      requiresAlternatingRoles: model.requiresAlternatingRoles,
      tokenizerType: model.tokenizerType,
      notes: model.notes,
      sortOrder: model.sortOrder,
      isEnabled: model.isEnabled,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }

  private toFallbackGroupResponse(group: FallbackGroupWithCandidates): ModelFallbackGroupResponse {
    return {
      id: group.id,
      userId: group.userId,
      name: group.name,
      isDefault: group.isDefault,
      isEnabled: group.isEnabled,
      candidates: group.candidates.map((candidate) => this.toFallbackCandidateResponse(candidate)),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString()
    };
  }

  private toFallbackCandidateResponse(
    candidate: FallbackCandidateWithModel
  ): ModelFallbackCandidateResponse {
    return {
      id: candidate.id,
      groupId: candidate.groupId,
      modelId: candidate.modelId,
      priority: candidate.priority,
      isEnabled: candidate.isEnabled,
      model: this.toProviderModelResponse(candidate.model)
    };
  }

  private toGatewayConfigFromProviderModel(
    model: ProviderModelWithProvider,
    groupId: string | null
  ): ModelGatewayConfig {
    const params = {
      ...(model.provider.timeout === null ? {} : { timeout: model.provider.timeout }),
      ...this.parseParams(model.defaultParamsJson)
    };

    return {
      providerModelId: model.id,
      modelFallbackGroupId: groupId,
      displayName: `${model.provider.name} / ${model.name}`,
      providerName: model.provider.provider,
      baseUrl: model.provider.baseUrl,
      modelName: model.model,
      apiKey: this.decryptApiKey(model.provider.apiKeyCiphertext),
      contextLength: model.contextLength,
      capabilities: {
        supportsDeveloperRole: model.supportsDeveloperRole,
        systemPlacement: model.systemPlacement as 'initial_only' | 'midstream_allowed',
        supportsMultipleSystemMessages: model.supportsMultipleSystemMessages,
        requiresAlternatingRoles: model.requiresAlternatingRoles,
        contextWindowTokens: model.contextLength ?? 8192,
        tokenizerType: model.tokenizerType
      },
      params
    };
  }

  private pickProviderModelParams(dto: CreateProviderModelDto): ModelGenerationParams {
    return this.mergeProviderModelParams({}, dto);
  }

  private mergeProviderModelParams(
    existing: ModelGenerationParams,
    dto: Partial<CreateProviderModelDto | UpdateProviderModelDto>
  ): ModelGenerationParams {
    const next: ModelGenerationParams = { ...existing };

    if (dto.temperature !== undefined) {
      if (dto.temperature === null) {
        delete next.temperature;
      } else {
        next.temperature = dto.temperature;
      }
    }

    if (dto.topP !== undefined) {
      if (dto.topP === null) {
        delete next.topP;
      } else {
        next.topP = dto.topP;
      }
    }

    if (dto.maxTokens !== undefined) {
      if (dto.maxTokens === null) {
        delete next.maxTokens;
      } else {
        next.maxTokens = dto.maxTokens;
      }
    }

    if (dto.timeout !== undefined) {
      if (dto.timeout === null) {
        delete next.timeout;
      } else {
        next.timeout = dto.timeout;
      }
    }

    if (dto.frequencyPenalty !== undefined) {
      if (dto.frequencyPenalty === null) delete next.frequencyPenalty;
      else next.frequencyPenalty = dto.frequencyPenalty;
    }

    if (dto.presencePenalty !== undefined) {
      if (dto.presencePenalty === null) delete next.presencePenalty;
      else next.presencePenalty = dto.presencePenalty;
    }

    return next;
  }

  private hasProviderModelParamUpdate(dto: UpdateProviderModelDto): boolean {
    return (
      dto.temperature !== undefined ||
      dto.topP !== undefined ||
      dto.maxTokens !== undefined ||
      dto.timeout !== undefined ||
      dto.frequencyPenalty !== undefined ||
      dto.presencePenalty !== undefined
    );
  }

  /** 保存前拒绝当前 Gateway 无法处理的 providerName。 */
  private assertSupportedProviderName(providerName: string): void {
    if (this.modelGateway.supportsProviderName(providerName)) return;

    throw new BadRequestException({
      code: ERROR_CODES.MODEL_GATEWAY_PROVIDER_UNSUPPORTED,
      message: `Model provider "${providerName}" is not registered in Model Gateway.`
    });
  }

  /**
   * 参数对象 → JSON 字符串；空对象返回 null。
   * @param params 参数对象。
   * @returns JSON 字符串，空对象返回 null。
   */
  private stringifyParams(params: ModelGenerationParams): string | null {
    return Object.keys(params).length > 0 ? JSON.stringify(params) : null;
  }

  /**
   * 解析 paramsJson；为空或解析失败返回空对象，且只保留合法数值字段。
   * @param value paramsJson 字符串。
   * @returns 解析后的参数对象。
   */
  private parseParams(value: string | null): ModelGenerationParams {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Partial<ModelGenerationParams>;

      return {
        // 各字段校验类型后才保留（防止脏数据）
        ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
        ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
        ...(Number.isInteger(parsed.maxTokens) ? { maxTokens: parsed.maxTokens } : {}),
        ...(Number.isInteger(parsed.timeout) ? { timeout: parsed.timeout } : {}),
        ...(typeof parsed.frequencyPenalty === 'number'
          ? { frequencyPenalty: parsed.frequencyPenalty }
          : {}),
        ...(typeof parsed.presencePenalty === 'number'
          ? { presencePenalty: parsed.presencePenalty }
          : {})
      };
    } catch {
      return {};
    }
  }

  /**
   * 规范化 apiKey：空值（null/undefined/空串）统一返回 null。
   * @param value 原始 apiKey。
   * @returns 规范化后的 apiKey，空值返回 null。
   */
  private normalizeApiKey(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return value;
  }

  /**
   * AES-256-GCM 加密 apiKey。
   * @param value apiKey 明文。
   * @returns 格式 `v1:<iv>:<authTag>:<ciphertext>`，均为 base64；null 返回 null。
   */
  private encryptApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    // 随机 12 字节 IV
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.apiKeyEncryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    // GCM 的 authTag 用于解密时校验完整性（防篡改）
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString(
      'base64'
    )}`;
  }

  /**
   * 解密 apiKey。
   * @param value 加密的 apiKey 字符串。
   * @returns 明文 apiKey；null 或解密失败返回 null；非 v1 格式（旧明文）原样返回。
   */
  private decryptApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    // 不以 v1: 开头视为明文（兼容旧数据），直接返回
    if (!value.startsWith('v1:')) {
      return value;
    }

    // 拆出 iv / authTag / ciphertext
    const [, ivBase64, authTagBase64, ciphertextBase64] = value.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
      return null;
    }

    try {
      // 解密时校验 authTag，不匹配会抛错（被 catch 成 null）
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.apiKeyEncryptionKey,
        Buffer.from(ivBase64, 'base64')
      );
      decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextBase64, 'base64')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      return null;
    }
  }

  /**
   * apiKey 脱敏：保留首尾少量字符，中间用 **** 代替。
   * @param value apiKey 明文。
   * @returns 脱敏串，如 `sk-****1234`；null 返回 null。
   */
  private maskApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    // 太短全掩码，避免泄露
    if (value.length <= 8) {
      return '****';
    }

    // sk- 开头保留前 3，否则前 2；末尾保留 4 位
    const prefix = value.startsWith('sk-') ? value.slice(0, 3) : value.slice(0, 2);

    return `${prefix}****${value.slice(-4)}`;
  }

  /**
   * 若是 Prisma 唯一约束冲突（P2002），转成 409 配置名重复；否则什么都不做。
   * 用 `never | void` 联合：冲突时抛出（never），无冲突时正常返回（void）。
   * @param error 捕获的异常。
   */
  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.MODEL_CONFIG_NAME_EXISTS,
        message: 'Model config name already exists.'
      });
    }
  }
}
