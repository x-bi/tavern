import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ModelConfig } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { CreateModelConfigDto } from './dto/create-model-config.dto';
import type { QueryModelConfigsDto } from './dto/query-model-configs.dto';
import type { UpdateModelConfigDto } from './dto/update-model-config.dto';
import type {
  ModelConfigListResponse,
  ModelConfigParams,
  ModelConfigResponse,
  ModelConfigTestResponse
} from './model-config.types';

@Injectable()
export class ModelsService {
  private readonly apiKeyEncryptionKey: Buffer;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {
    this.apiKeyEncryptionKey = createHash('sha256')
      .update(this.configService.getOrThrow<string>('AUTH_TOKEN_SECRET'))
      .digest();
  }

  async list(currentUser: CurrentUser, query: QueryModelConfigsDto): Promise<ModelConfigListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
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

  async create(currentUser: CurrentUser, dto: CreateModelConfigDto): Promise<ModelConfigResponse> {
    const apiKey = this.normalizeApiKey(dto.apiKey);
    const data = {
      userId: currentUser.id,
      name: dto.name,
      provider: dto.providerName,
      baseUrl: dto.baseUrl,
      model: dto.modelName,
      apiKeyCiphertext: this.encryptApiKey(apiKey),
      apiKeyMask: this.maskApiKey(apiKey),
      defaultParamsJson: this.stringifyParams(this.pickParams(dto)),
      isDefault: dto.isDefault ?? false,
      isEnabled: dto.isEnabled ?? true
    };

    try {
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
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async getById(currentUser: CurrentUser, id: string): Promise<ModelConfigResponse> {
    return this.toResponse(await this.findOwnedActiveModelConfig(currentUser, id));
  }

  async testConnection(currentUser: CurrentUser, id: string): Promise<ModelConfigTestResponse> {
    const modelConfig = await this.findOwnedActiveModelConfig(currentUser, id);
    const startedAt = Date.now();
    const apiKey = this.decryptApiKey(modelConfig.apiKeyCiphertext);
    const baseResult = {
      providerName: modelConfig.provider,
      modelName: modelConfig.model,
      baseUrl: modelConfig.baseUrl,
      testedAt: new Date().toISOString()
    };

    if (!apiKey) {
      return {
        ...baseResult,
        ok: false,
        latencyMs: Date.now() - startedAt,
        statusCode: null,
        message: 'API Key 未配置，无法测试连接。',
        summary: null
      };
    }

    const controller = new AbortController();
    const timeoutMs = this.getConnectionTestTimeoutMs(modelConfig);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.toChatCompletionsUrl(modelConfig.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [
            {
              role: 'user',
              content: 'ping'
            }
          ],
          max_tokens: 1,
          temperature: 0,
          stream: false
        }),
        signal: controller.signal
      });
      const latencyMs = Date.now() - startedAt;
      const responseText = await response.text();

      if (!response.ok) {
        return {
          ...baseResult,
          ok: false,
          latencyMs,
          statusCode: response.status,
          message: `连接失败：HTTP ${response.status}`,
          summary: this.extractProviderSummary(responseText, apiKey)
        };
      }

      return {
        ...baseResult,
        ok: true,
        latencyMs,
        statusCode: response.status,
        message: '连接成功，已收到最小模型响应。',
        summary: this.extractSuccessSummary(responseText)
      };
    } catch (error) {
      return {
        ...baseResult,
        ok: false,
        latencyMs: Date.now() - startedAt,
        statusCode: null,
        message: this.toConnectionErrorMessage(error, timeoutMs),
        summary: null
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateModelConfigDto
  ): Promise<ModelConfigResponse> {
    const existing = await this.findOwnedActiveModelConfig(currentUser, id);
    const params = this.mergeParams(this.parseParams(existing.defaultParamsJson), dto);
    const apiKey = dto.apiKey === undefined ? undefined : this.normalizeApiKey(dto.apiKey);
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

  private pickParams(dto: CreateModelConfigDto): ModelConfigParams {
    return this.mergeParams({}, dto);
  }

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

  private hasParamUpdate(dto: UpdateModelConfigDto): boolean {
    return (
      dto.temperature !== undefined ||
      dto.topP !== undefined ||
      dto.maxTokens !== undefined ||
      dto.timeout !== undefined
    );
  }

  private stringifyParams(params: ModelConfigParams): string | null {
    return Object.keys(params).length > 0 ? JSON.stringify(params) : null;
  }

  private parseParams(value: string | null): ModelConfigParams {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Partial<ModelConfigParams>;

      return {
        ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
        ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
        ...(Number.isInteger(parsed.maxTokens) ? { maxTokens: parsed.maxTokens } : {}),
        ...(Number.isInteger(parsed.timeout) ? { timeout: parsed.timeout } : {})
      };
    } catch {
      return {};
    }
  }

  private normalizeApiKey(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return value;
  }

  private encryptApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.apiKeyEncryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString(
      'base64'
    )}`;
  }

  private decryptApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    if (!value.startsWith('v1:')) {
      return value;
    }

    const [, ivBase64, authTagBase64, ciphertextBase64] = value.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
      return null;
    }

    try {
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

  private toChatCompletionsUrl(baseUrl: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');

    return normalizedBaseUrl.endsWith('/chat/completions')
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/chat/completions`;
  }

  private getConnectionTestTimeoutMs(modelConfig: ModelConfig): number {
    const params = this.parseParams(modelConfig.defaultParamsJson);

    return Math.min(params.timeout ?? 30000, 60000);
  }

  private extractProviderSummary(responseText: string, apiKey: string): string | null {
    const rawSummary = this.tryExtractProviderMessage(responseText) ?? responseText;
    const sanitizedSummary = this.sanitizeProviderText(rawSummary, apiKey);

    return sanitizedSummary ? sanitizedSummary.slice(0, 500) : null;
  }

  private extractSuccessSummary(responseText: string): string | null {
    if (!responseText) {
      return '响应体为空，但 HTTP 状态为成功。';
    }

    try {
      const parsed = JSON.parse(responseText) as {
        id?: unknown;
        model?: unknown;
        choices?: unknown;
      };
      const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
      const parts = [
        typeof parsed.model === 'string' ? `model=${parsed.model}` : null,
        typeof parsed.id === 'string' ? `id=${parsed.id}` : null,
        `choices=${choices.length}`
      ].filter(Boolean);

      return parts.join(', ');
    } catch {
      return 'HTTP 成功，但响应体不是标准 JSON。';
    }
  }

  private tryExtractProviderMessage(responseText: string): string | null {
    if (!responseText) {
      return null;
    }

    try {
      const parsed = JSON.parse(responseText) as {
        error?: {
          message?: unknown;
          code?: unknown;
          type?: unknown;
        };
        message?: unknown;
      };

      if (typeof parsed.error?.message === 'string') {
        const parts = [
          parsed.error.message,
          typeof parsed.error.code === 'string' ? `code=${parsed.error.code}` : null,
          typeof parsed.error.type === 'string' ? `type=${parsed.error.type}` : null
        ].filter(Boolean);

        return parts.join(' ');
      }

      return typeof parsed.message === 'string' ? parsed.message : null;
    } catch {
      return null;
    }
  }

  private sanitizeProviderText(value: string, apiKey: string): string {
    return value
      .replaceAll(apiKey, '[api-key]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [api-key]')
      .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-****')
      .trim();
  }

  private toConnectionErrorMessage(error: unknown, timeoutMs: number): string {
    if (error instanceof Error && error.name === 'AbortError') {
      return `连接超时：超过 ${timeoutMs}ms 未收到响应。`;
    }

    return error instanceof Error && error.message
      ? `连接失败：${error.message}`
      : '连接失败：无法访问模型服务。';
  }

  private maskApiKey(value: string | null): string | null {
    if (!value) {
      return null;
    }

    if (value.length <= 8) {
      return '****';
    }

    const prefix = value.startsWith('sk-') ? value.slice(0, 3) : value.slice(0, 2);

    return `${prefix}****${value.slice(-4)}`;
  }

  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.MODEL_CONFIG_NAME_EXISTS,
        message: 'Model config name already exists.'
      });
    }
  }
}
