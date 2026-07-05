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
  type ModelConfig,
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
import type { CreateModelConfigDto } from './dto/create-model-config.dto';
import type { CreateModelFallbackGroupDto } from './dto/create-model-fallback-group.dto';
import type { CreateModelProviderDto } from './dto/create-model-provider.dto';
import type { CreateProviderModelDto } from './dto/create-provider-model.dto';
import type { QueryModelConfigsDto } from './dto/query-model-configs.dto';
import type { UpdateModelFallbackGroupDto } from './dto/update-model-fallback-group.dto';
import type { UpdateModelConfigDto } from './dto/update-model-config.dto';
import type { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import type { UpdateProviderModelDto } from './dto/update-provider-model.dto';
import type {
  ModelFallbackCandidateResponse,
  ModelFallbackGroupResponse,
  ModelConfigListResponse,
  ModelConfigParams,
  ModelConfigResponse,
  ModelGatewayConfig,
  ModelConfigTestResponse,
  ModelProviderResponse,
  ProviderModelResponse
} from './model-config.types';

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
 * 模型配置服务：管理 AI 模型配置的 CRUD、API Key 加解密、连接测试。
 *
 * 设计要点：
 * - API Key 用 AES-256-GCM 加密存储，密钥由 AUTH_TOKEN_SECRET 派生（SHA-256）；
 * - 每个 isDefault=true 的配置在事务内保证用户范围内默认唯一（先取消旧默认）；
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
    private readonly modelGateway: ModelGatewayService
  ) {
    this.apiKeyEncryptionKey = createHash('sha256')
      .update(this.configService.getOrThrow<string>('AUTH_TOKEN_SECRET'))
      .digest();
  }

  /**
   * 分页查询当前用户的模型配置。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/启用过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(currentUser: CurrentUser, query: QueryModelConfigsDto): Promise<ModelConfigListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    // 构建查询条件：限定当前用户 + 未软删除
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      // isEnabled 未传时不加条件，传了则按值过滤
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      // search 关键字：匹配 name/provider/model/baseUrl 任一包含
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { provider: { contains: query.search } },
              { model: { contains: query.search } },
              { baseUrl: { contains: query.search } }
            ]
          }
        : {})
    };

    // 事务内并行：查当前页 + 统计总数，默认配置排在最前
    const [items, total] = await this.prisma.$transaction([
      this.prisma.modelConfig.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.modelConfig.count({ where })
    ]);

    return {
      items: items.map((modelConfig) => this.toResponse(modelConfig)),
      total,
      page,
      pageSize
    };
  }

  async listProviders(
    currentUser: CurrentUser,
    query: QueryModelConfigsDto
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

  async removeProvider(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
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
    query: QueryModelConfigsDto,
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
    const params = this.mergeProviderModelParams(
      this.parseParams(existing.defaultParamsJson),
      dto
    );

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
    query: QueryModelConfigsDto
  ): Promise<{ items: ModelFallbackGroupResponse[]; total: number; page: number; pageSize: number }> {
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
  ): Promise<ModelConfigTestResponse> {
    const model = await this.findOwnedActiveProviderModel(currentUser, id);

    return this.modelGateway.testConnection(this.toGatewayConfigFromProviderModel(model, null));
  }

  async getGatewayCandidates(params: {
    currentUser: CurrentUser;
    modelFallbackGroupId?: string | null;
    modelConfigId?: string | null;
  }): Promise<ModelGatewayConfig[]> {
    const group =
      params.modelFallbackGroupId === undefined
        ? await this.findDefaultActiveFallbackGroup(params.currentUser)
        : await this.findOwnedActiveFallbackGroup(params.currentUser, params.modelFallbackGroupId);

    if (group) {
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

      if (candidates.length > 0) {
        return candidates.map((candidate) =>
          this.toGatewayConfigFromProviderModel(candidate.model, group.id)
        );
      }
    }

    return [await this.getGatewayConfig(params.currentUser, params.modelConfigId)];
  }

  /**
   * 创建模型配置。
   * @param currentUser 当前登录用户。
   * @param dto 创建入参。
   * @returns 创建后的模型配置响应。
   * @throws ConflictException 配置名重复（唯一约束冲突）。
   */
  async create(currentUser: CurrentUser, dto: CreateModelConfigDto): Promise<ModelConfigResponse> {
    // apiKey 规范化（空串/undefined/null → null）
    const apiKey = this.normalizeApiKey(dto.apiKey);
    const data = {
      userId: currentUser.id,
      name: dto.name,
      provider: dto.providerName,
      baseUrl: dto.baseUrl,
      model: dto.modelName,
      // apiKey 加密后存储，并生成脱敏 mask
      apiKeyCiphertext: this.encryptApiKey(apiKey),
      apiKeyMask: this.maskApiKey(apiKey),
      // 参数提取后序列化成 JSON 存储
      defaultParamsJson: this.stringifyParams(this.pickParams(dto)),
      isDefault: dto.isDefault ?? false,
      isEnabled: dto.isEnabled ?? true
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认，再创建（保证默认唯一）
      // isDefault=false：直接创建
      const modelConfig = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.modelConfig.updateMany({
              where: {
                userId: currentUser.id,
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.modelConfig.create({ data });
          })
        : await this.prisma.modelConfig.create({ data });

      return this.toResponse(modelConfig);
    } catch (error) {
      // 捕获唯一名冲突（P2002）转成 409；其它错误重新抛出
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 获取单个模型配置。
   * @param currentUser 当前登录用户。
   * @param id 模型配置 ID。
   * @returns 模型配置响应。
   * @throws NotFoundException 配置不存在或不属于该用户。
   */
  async getById(currentUser: CurrentUser, id: string): Promise<ModelConfigResponse> {
    return this.toResponse(await this.findOwnedActiveModelConfig(currentUser, id));
  }

  /**
   * 取模型网关调用配置（含解密后的 apiKey 明文）。
   *
   * @param currentUser 当前登录用户。
   * @param id 指定配置 ID；为空则取用户的默认/最新启用配置。
   * @returns 网关调用配置（含解密 apiKey）。
   * @throws BadRequestException 配置未启用（不可用作网关配置）。
   * @throws NotFoundException 配置不存在或不属于该用户。
   */
  async getGatewayConfig(
    currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<ModelGatewayConfig> {
    // id 非空取指定配置，否则取默认配置
    const modelConfig = id
      ? await this.findOwnedActiveModelConfig(currentUser, id)
      : await this.findDefaultActiveModelConfig(currentUser);

    // 未启用的配置不可用作网关配置
    if (!modelConfig.isEnabled) {
      throw new BadRequestException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model config not found.'
      });
    }

    return {
      modelConfigId: modelConfig.id,
      providerName: modelConfig.provider,
      baseUrl: modelConfig.baseUrl,
      modelName: modelConfig.model,
      // 解密 apiKey 供网关调用
      apiKey: this.decryptApiKey(modelConfig.apiKeyCiphertext),
      params: this.parseParams(modelConfig.defaultParamsJson)
    };
  }

  /**
   * 测试模型连接。
   * @param currentUser 当前登录用户。
   * @param id 模型配置 ID。
   * @returns 未配置 apiKey 时返回失败结果；否则调用网关测试。
   * @throws NotFoundException 配置不存在或不属于该用户。
   */
  async testConnection(currentUser: CurrentUser, id: string): Promise<ModelConfigTestResponse> {
    const modelConfig = await this.findOwnedActiveModelConfig(currentUser, id);
    const apiKey = this.decryptApiKey(modelConfig.apiKeyCiphertext);

    // 未配置 apiKey：直接返回失败，不调网关
    if (!apiKey) {
      return {
        ok: false,
        latencyMs: 0,
        providerName: modelConfig.provider,
        modelName: modelConfig.model,
        baseUrl: modelConfig.baseUrl,
        statusCode: null,
        message: 'API Key 未配置，无法测试连接。',
        summary: null,
        testedAt: new Date().toISOString()
      };
    }

    // 调网关实际测试连接
    return this.modelGateway.testConnection({
      providerName: modelConfig.provider,
      baseUrl: modelConfig.baseUrl,
      modelName: modelConfig.model,
      apiKey,
      ...this.parseParams(modelConfig.defaultParamsJson)
    });
  }

  /**
   * 更新模型配置（部分更新）。
   * @param currentUser 当前登录用户。
   * @param id 模型配置 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的模型配置响应。
   * @throws ConflictException 配置名重复。
   * @throws NotFoundException 配置不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateModelConfigDto
  ): Promise<ModelConfigResponse> {
    // 取现有配置，用于合并参数
    const existing = await this.findOwnedActiveModelConfig(currentUser, id);
    // 合并参数：现有参数 + DTO 传入的参数（后者覆盖前者）
    const params = this.mergeParams(this.parseParams(existing.defaultParamsJson), dto);
    // apiKey：未传(undefined)不动，传则规范化
    const apiKey = dto.apiKey === undefined ? undefined : this.normalizeApiKey(dto.apiKey);
    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // apiKey 传了则同时更新密文和 mask；有参数更新才重写 paramsJson
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.providerName === undefined ? {} : { provider: dto.providerName }),
      ...(dto.baseUrl === undefined ? {} : { baseUrl: dto.baseUrl }),
      ...(dto.modelName === undefined ? {} : { model: dto.modelName }),
      ...(apiKey === undefined
        ? {}
        : {
            apiKeyCiphertext: this.encryptApiKey(apiKey),
            apiKeyMask: this.maskApiKey(apiKey)
          }),
      ...(this.hasParamUpdate(dto) ? { defaultParamsJson: this.stringifyParams(params) } : {}),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }),
      ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled })
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认（排除自身），再更新
      const modelConfig = dto.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.modelConfig.updateMany({
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

            return tx.modelConfig.update({
              where: { id },
              data
            });
          })
        : await this.prisma.modelConfig.update({
            where: { id },
            data
          });

      return this.toResponse(modelConfig);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 删除模型配置（软删除）。
   *
   * 改名加 `__deleted__` 后缀以释放唯一名约束，便于后续创建同名配置；
   * 同时取消默认、禁用、标记删除时间。
   * @param currentUser 当前登录用户。
   * @param id 模型配置 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 配置不存在或不属于该用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActiveModelConfig(currentUser, id);

    await this.prisma.modelConfig.update({
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

  private toProviderResponse(
    provider: ModelProvider,
    modelCount: number
  ): ModelProviderResponse {
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
      timeout: params.timeout ?? model.provider.timeout ?? null,
      contextLength: model.contextLength,
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
      modelConfigId: null,
      providerModelId: model.id,
      modelFallbackGroupId: groupId,
      displayName: `${model.provider.name} / ${model.name}`,
      providerName: model.provider.provider,
      baseUrl: model.provider.baseUrl,
      modelName: model.model,
      apiKey: this.decryptApiKey(model.provider.apiKeyCiphertext),
      params
    };
  }

  /**
   * 查询配置并校验所有权：限定 id + 当前用户 + 未删除。
   * @param currentUser 当前登录用户。
   * @param id 模型配置 ID。
   * @returns 校验通过的模型配置记录。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActiveModelConfig(
    currentUser: CurrentUser,
    id: string
  ): Promise<ModelConfig> {
    const modelConfig = await this.prisma.modelConfig.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      }
    });

    if (!modelConfig) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model config not found.'
      });
    }

    return modelConfig;
  }

  /**
   * 取用户的默认/最新启用配置（id 为空时使用）。
   * 优先 isDefault，其次按更新时间倒序。
   * @param currentUser 当前登录用户。
   * @returns 默认或最新启用配置。
   * @throws NotFoundException 无任何启用配置。
   */
  private async findDefaultActiveModelConfig(currentUser: CurrentUser): Promise<ModelConfig> {
    const modelConfig = await this.prisma.modelConfig.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        isEnabled: true
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    if (!modelConfig) {
      throw new NotFoundException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model config not found.'
      });
    }

    return modelConfig;
  }

  /**
   * 数据库记录 → 对外响应（解析参数 JSON、脱敏 apiKey、格式化时间）。
   * @param modelConfig 模型配置数据库记录。
   * @returns 模型配置响应。
   */
  private toResponse(modelConfig: ModelConfig): ModelConfigResponse {
    const params = this.parseParams(modelConfig.defaultParamsJson);

    return {
      id: modelConfig.id,
      userId: modelConfig.userId,
      name: modelConfig.name,
      providerName: modelConfig.provider,
      baseUrl: modelConfig.baseUrl,
      modelName: modelConfig.model,
      apiKeyMask: modelConfig.apiKeyMask,
      hasApiKey: Boolean(modelConfig.apiKeyCiphertext),
      temperature: params.temperature ?? null,
      topP: params.topP ?? null,
      maxTokens: params.maxTokens ?? null,
      timeout: params.timeout ?? null,
      isDefault: modelConfig.isDefault,
      isEnabled: modelConfig.isEnabled,
      createdAt: modelConfig.createdAt.toISOString(),
      updatedAt: modelConfig.updatedAt.toISOString()
    };
  }

  /**
   * 从创建 DTO 提取参数（mergeParams 的空基准版）。
   * @param dto 创建入参。
   * @returns 提取出的参数对象。
   */
  private pickParams(dto: CreateModelConfigDto): ModelConfigParams {
    return this.mergeParams({}, dto);
  }

  private pickProviderModelParams(dto: CreateProviderModelDto): ModelConfigParams {
    return this.mergeProviderModelParams({}, dto);
  }

  private mergeProviderModelParams(
    existing: ModelConfigParams,
    dto: Partial<CreateProviderModelDto | UpdateProviderModelDto>
  ): ModelConfigParams {
    const next: ModelConfigParams = { ...existing };

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

    return next;
  }

  /**
   * 合并参数：现有参数 + DTO 参数（后者覆盖前者），undefined 的跳过。
   * 用于 create（基准空）和 update（基准为现有参数）。
   * @param existing 现有参数。
   * @param dto DTO（create 或 update）。
   * @returns 合并后的参数对象。
   */
  private mergeParams(
    existing: ModelConfigParams,
    dto: Partial<CreateModelConfigDto | UpdateModelConfigDto>
  ): ModelConfigParams {
    return {
      ...(existing.temperature === undefined ? {} : { temperature: existing.temperature }),
      ...(existing.topP === undefined ? {} : { topP: existing.topP }),
      ...(existing.maxTokens === undefined ? {} : { maxTokens: existing.maxTokens }),
      ...(existing.timeout === undefined ? {} : { timeout: existing.timeout }),
      ...(dto.temperature === undefined ? {} : { temperature: dto.temperature }),
      ...(dto.topP === undefined ? {} : { topP: dto.topP }),
      ...(dto.maxTokens === undefined ? {} : { maxTokens: dto.maxTokens }),
      ...(dto.timeout === undefined ? {} : { timeout: dto.timeout })
    };
  }

  /**
   * 判断 DTO 是否含参数更新（决定是否重写 paramsJson）。
   * @param dto 更新入参。
   * @returns 含任一参数字段返回 true。
   */
  private hasParamUpdate(dto: UpdateModelConfigDto): boolean {
    return (
      dto.temperature !== undefined ||
      dto.topP !== undefined ||
      dto.maxTokens !== undefined ||
      dto.timeout !== undefined
    );
  }

  private hasProviderModelParamUpdate(dto: UpdateProviderModelDto): boolean {
    return (
      dto.temperature !== undefined ||
      dto.topP !== undefined ||
      dto.maxTokens !== undefined ||
      dto.timeout !== undefined
    );
  }

  /**
   * 参数对象 → JSON 字符串；空对象返回 null。
   * @param params 参数对象。
   * @returns JSON 字符串，空对象返回 null。
   */
  private stringifyParams(params: ModelConfigParams): string | null {
    return Object.keys(params).length > 0 ? JSON.stringify(params) : null;
  }

  /**
   * 解析 paramsJson；为空或解析失败返回空对象，且只保留合法数值字段。
   * @param value paramsJson 字符串。
   * @returns 解析后的参数对象。
   */
  private parseParams(value: string | null): ModelConfigParams {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Partial<ModelConfigParams>;

      return {
        // 各字段校验类型后才保留（防止脏数据）
        ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
        ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
        ...(Number.isInteger(parsed.maxTokens) ? { maxTokens: parsed.maxTokens } : {}),
        ...(Number.isInteger(parsed.timeout) ? { timeout: parsed.timeout } : {})
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
