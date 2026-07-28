import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { ServerConfig } from '../../config/server.config';
import { estimatePromptMessagesTokens } from '../../services/prompt-builder/token-estimator';
import {
  ModelGatewayError,
  ModelGatewayService,
  type ModelGatewayChatResult,
  type ModelGatewayMessage,
  type ModelGatewayRequestSource
} from '../../services/model-gateway';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig } from '../models/model.types';
import type { CurrentUser } from '../users/user.types';
import { AiImportPromptFactory } from './ai-import-prompt.factory';
import { AiImportRepairPromptFactory } from './ai-import-repair-prompt.factory';
import { AiImportStrategyRegistry } from './ai-import-strategy.registry';
import { AiImportTargetRegistry } from './ai-import-target.registry';
import {
  AI_IMPORT_MODES,
  AI_IMPORT_TARGETS,
  type AiImportMode,
  type AiImportTarget,
  type NormalizedAiImportEnvelope
} from './ai-import.types';
import type { TransformAiImportDto } from './dto/transform-ai-import.dto';
import { extractSingleJsonObject } from './extract-single-json-object';
import { normalizeAiImportEnvelope } from './normalize-ai-import-envelope';

type UploadedTextFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type ModelCall = {
  result: ModelGatewayChatResult;
  candidateIndex: number;
};

const TARGET_OPTIONS = [
  { value: 'character', label: '角色', description: '普通 Tavern 角色卡' },
  { value: 'persona', label: 'Persona', description: '用户身份与互动偏好' },
  { value: 'prompt_preset', label: '提示词预设', description: '通用生成规则和参数' },
  { value: 'world_book', label: '世界书', description: '设定条目和运行配置' },
  { value: 'companion', label: 'AI 角色', description: '独立长期陪伴角色' }
] as const;

const MODE_OPTIONS = [
  { value: 'fill_missing', label: '保守补全', description: '最大程度保留原始内容，主要补缺。' },
  { value: 'smart_optimize', label: '智能优化', description: '补全并优化语义不合理配置。' },
  { value: 'rebuild', label: '重新构建', description: '保护事实的前提下重组完整结构。' }
] as const;

@Injectable()
export class AiImportsService {
  private readonly activeRequests = new Map<string, AbortController>();
  private readonly limits: ServerConfig['aiImport'];

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(ModelsService) private readonly models: ModelsService,
    @Inject(ModelGatewayService) private readonly gateway: ModelGatewayService,
    @Inject(AiImportStrategyRegistry) private readonly strategies: AiImportStrategyRegistry,
    @Inject(AiImportTargetRegistry) private readonly targets: AiImportTargetRegistry,
    @Inject(AiImportPromptFactory) private readonly promptFactory: AiImportPromptFactory,
    @Inject(AiImportRepairPromptFactory)
    private readonly repairPromptFactory: AiImportRepairPromptFactory
  ) {
    this.limits = config.getOrThrow<ServerConfig>('server').aiImport;
  }

  getOptions(target: AiImportTarget = 'character', mode: AiImportMode = 'smart_optimize') {
    this.assertTargetAndMode(target, mode);
    const options = this.strategies.getOptions(target, mode);
    return {
      targets: TARGET_OPTIONS,
      modes: MODE_OPTIONS,
      generalStrategies: options.filter((item) => item.scope === 'general'),
      moduleStrategies: options.filter((item) => item.scope === 'module'),
      defaults: {
        generalStrategyIds: options
          .filter((item) => item.scope === 'general' && item.defaultEnabled && !item.disabled)
          .map((item) => item.id),
        moduleStrategyIds: options
          .filter((item) => item.scope === 'module' && item.defaultEnabled && !item.disabled)
          .map((item) => item.id)
      },
      limits: {
        ...this.limits,
        allowedExtensions: ['.json', '.txt', '.md']
      }
    };
  }

  async transform(
    currentUser: CurrentUser,
    dto: TransformAiImportDto,
    upstreamSignal?: AbortSignal
  ) {
    this.validateRequest(dto);
    if (this.activeRequests.has(currentUser.id)) {
      throw new ConflictException({
        code: ERROR_CODES.AI_IMPORT_CONCURRENT_REQUEST,
        message: 'An AI import request is already running for this user.'
      });
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    upstreamSignal?.addEventListener('abort', abort, { once: true });
    this.activeRequests.set(currentUser.id, controller);
    try {
      return await this.executeTransform(currentUser, dto, controller.signal);
    } finally {
      upstreamSignal?.removeEventListener('abort', abort);
      this.activeRequests.delete(currentUser.id);
    }
  }

  async transformFile(
    currentUser: CurrentUser,
    dto: Omit<TransformAiImportDto, 'sourceText'>,
    file: UploadedTextFile,
    upstreamSignal?: AbortSignal
  ) {
    const sourceText = this.decodeFile(file);
    return this.transform(currentUser, { ...dto, sourceText }, upstreamSignal);
  }

  async validate(currentUser: CurrentUser, target: AiImportTarget, rawJson: string) {
    this.assertTargetAndMode(target, 'smart_optimize');
    let result: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (!isRecord(parsed)) throw new Error('Root must be an object.');
      result = parsed;
      const preview = await this.targets.get(target).previewImport(currentUser, rawJson);
      return { target, rawJson, result, preview, errors: [], valid: true };
    } catch (error) {
      return {
        target,
        rawJson,
        result,
        preview: null,
        errors: [this.toValidationError(error)],
        valid: false
      };
    }
  }

  private async executeTransform(
    currentUser: CurrentUser,
    dto: TransformAiImportDto,
    signal: AbortSignal
  ) {
    const adapter = this.targets.get(dto.target);
    const selectedStrategies = this.strategies.resolve(
      dto.target,
      dto.mode,
      dto.generalStrategyIds ?? [],
      dto.moduleStrategyIds ?? []
    );
    const specification = adapter.getImportSpecification();
    const messages = this.promptFactory.build({
      target: dto.target,
      mode: dto.mode,
      specification,
      strategies: selectedStrategies,
      customInstructions: dto.customInstructions?.trim() ?? '',
      sourceText: dto.sourceText
    });
    const candidates = await this.resolveCandidates(currentUser, dto.modelFallbackGroupId);
    const firstCall = await this.callCandidates(
      candidates,
      0,
      messages,
      dto.target,
      'ai_import_transform',
      signal
    );
    let repairAttempted = false;
    let currentText = firstCall.result.text;
    let modelCall = firstCall;
    let normalized: NormalizedAiImportEnvelope | null = null;
    let preview: unknown = null;
    let errors: Array<{ code: string; message: string; field?: string }> = [];

    try {
      normalized = this.parseEnvelope(currentText, dto.sourceText);
      preview = await adapter.previewImport(currentUser, JSON.stringify(normalized.result));
    } catch (error) {
      repairAttempted = true;
      errors = [this.toValidationError(error)];
      const repairMessages = this.repairPromptFactory.build({
        target: dto.target,
        mode: dto.mode,
        specification,
        strategies: selectedStrategies,
        customInstructions: dto.customInstructions?.trim() ?? '',
        sourceText: dto.sourceText,
        previousOutput: currentText,
        errors
      });
      try {
        modelCall = await this.callCandidates(
          candidates,
          firstCall.candidateIndex,
          repairMessages,
          dto.target,
          'ai_import_repair',
          signal
        );
        currentText = modelCall.result.text;
        normalized = this.parseEnvelope(currentText, dto.sourceText);
        preview = await adapter.previewImport(currentUser, JSON.stringify(normalized.result));
        errors = [];
      } catch (repairError) {
        errors = [this.toValidationError(repairError)];
      }
    }

    const result = normalized?.result ?? this.tryReadResult(currentText);
    const rawJson = result ? JSON.stringify(result, null, 2) : '';
    return {
      target: dto.target,
      mode: dto.mode,
      rawJson,
      result: result ?? {},
      preview,
      decisions: normalized?.decisions ?? [],
      warnings: normalized?.warnings ?? [],
      errors,
      valid: Boolean(result && preview && errors.length === 0),
      repairAttempted,
      model: this.toSafeModel(dto.modelFallbackGroupId, modelCall.result)
    };
  }

  private parseEnvelope(text: string, sourceText: string): NormalizedAiImportEnvelope {
    return normalizeAiImportEnvelope(
      extractSingleJsonObject(text, this.limits.modelOutputMaxChars),
      sourceText
    );
  }

  private tryReadResult(text: string): Record<string, unknown> | null {
    try {
      const envelope = extractSingleJsonObject(text, this.limits.modelOutputMaxChars);
      return isRecord(envelope.result) ? envelope.result : null;
    } catch {
      return null;
    }
  }

  private async resolveCandidates(currentUser: CurrentUser, groupId: string) {
    let candidates: ModelGatewayConfig[];
    try {
      candidates = await this.models.getGatewayCandidates({
        currentUser,
        modelFallbackGroupId: groupId
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException({
          code: ERROR_CODES.AI_IMPORT_MODEL_GROUP_NOT_FOUND,
          message: 'The selected model fallback group was not found.'
        });
      }
      throw error;
    }
    if (candidates.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_MODEL_GROUP_EMPTY,
        message: 'The selected model fallback group has no enabled candidates.'
      });
    }
    return candidates;
  }

  private async callCandidates(
    candidates: ModelGatewayConfig[],
    startIndex: number,
    messages: ModelGatewayMessage[],
    target: AiImportTarget,
    requestSource: ModelGatewayRequestSource,
    signal: AbortSignal
  ): Promise<ModelCall> {
    const promptTokens = estimatePromptMessagesTokens(messages);
    const outputTokens = target === 'world_book' ? 8192 : 4096;
    let contextSkipped = 0;
    let attempted = 0;
    for (let index = startIndex; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (promptTokens + outputTokens + 512 > candidate.capabilities.contextWindowTokens) {
        contextSkipped += 1;
        continue;
      }
      attempted += 1;
      try {
        const result = await this.gateway.chat(messages, {
          providerName: candidate.providerName,
          baseUrl: candidate.baseUrl,
          modelName: candidate.modelName,
          apiKey: candidate.apiKey,
          temperature: 0,
          topP: 1,
          maxTokens: outputTokens,
          timeout: candidate.params.timeout,
          requestSource,
          signal
        });
        if (!result.text.trim())
          throw new ModelGatewayError(
            ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
            'Model returned an empty response.'
          );
        return { result, candidateIndex: index };
      } catch (error) {
        if (signal.aborted) throw error;
        if (!(error instanceof ModelGatewayError)) throw error;
      }
    }
    if (attempted === 0 && contextSkipped > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_CONTEXT_LIMIT_EXCEEDED,
        message: 'No model candidate has enough context capacity for this AI import.'
      });
    }
    throw new BadRequestException({
      code: ERROR_CODES.AI_IMPORT_ALL_MODELS_FAILED,
      message: 'All model candidates failed to process this AI import.'
    });
  }

  private validateRequest(dto: TransformAiImportDto): void {
    this.assertTargetAndMode(dto.target, dto.mode);
    const source = dto.sourceText.trim();
    if (!source) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_SOURCE_EMPTY,
        message: 'AI import source text is required.'
      });
    }
    if (dto.sourceText.length > this.limits.sourceMaxChars) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_SOURCE_TOO_LARGE,
        message: `AI import source exceeds ${this.limits.sourceMaxChars} characters.`
      });
    }
    if ((dto.customInstructions?.length ?? 0) > this.limits.customInstructionsMaxChars) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_CUSTOM_INSTRUCTIONS_TOO_LONG,
        message: `Custom instructions exceed ${this.limits.customInstructionsMaxChars} characters.`
      });
    }
    if (
      dto.mode === 'fill_missing' &&
      /完全重写|彻底重写|全部重构|重新设计所有/.test(dto.customInstructions ?? '')
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_STRATEGY_CONFLICT,
        message: '保守补全与完全重写要求冲突，请改用“重新构建”。'
      });
    }
    this.strategies.resolve(
      dto.target,
      dto.mode,
      dto.generalStrategyIds ?? [],
      dto.moduleStrategyIds ?? []
    );
  }

  private assertTargetAndMode(target: AiImportTarget, mode: AiImportMode): void {
    if (!(AI_IMPORT_TARGETS as readonly string[]).includes(target)) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_TARGET_UNSUPPORTED,
        message: `Unsupported AI import target: ${target}.`
      });
    }
    if (!(AI_IMPORT_MODES as readonly string[]).includes(mode)) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_MODE_UNSUPPORTED,
        message: `Unsupported AI import mode: ${mode}.`
      });
    }
  }

  private decodeFile(file: UploadedTextFile): string {
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    const allowedMime = new Set([
      'application/json',
      'text/plain',
      'text/markdown',
      'application/octet-stream'
    ]);
    if (!['.json', '.txt', '.md'].includes(extension) || !allowedMime.has(file.mimetype)) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_FILE_TYPE_UNSUPPORTED,
        message: 'Only UTF-8 .json, .txt and .md files are supported.'
      });
    }
    if (file.size > this.limits.fileMaxBytes) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_FILE_TOO_LARGE,
        message: `AI import file exceeds ${this.limits.fileMaxBytes} bytes.`
      });
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(file.buffer).replace(/^\uFEFF/, '');
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_FILE_ENCODING_INVALID,
        message: 'AI import file must use valid UTF-8 encoding.'
      });
    }
  }

  private toValidationError(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response !== null) {
        const body = response as { code?: unknown; message?: unknown; details?: unknown };
        return {
          code: typeof body.code === 'string' ? body.code : ERROR_CODES.AI_IMPORT_VALIDATION_FAILED,
          message:
            typeof body.message === 'string'
              ? body.message
              : 'AI import result failed deterministic validation.',
          ...(typeof body.details === 'string' ? { field: body.details } : {})
        };
      }
    }
    return {
      code: ERROR_CODES.AI_IMPORT_VALIDATION_FAILED,
      message: 'AI import result failed deterministic validation.'
    };
  }

  private toSafeModel(groupId: string, result: ModelGatewayChatResult) {
    return {
      modelFallbackGroupId: groupId,
      providerName: result.providerName,
      modelName: result.modelName,
      finishReason: result.finishReason ?? null,
      promptTokens: result.usage?.promptTokens ?? null,
      completionTokens: result.usage?.completionTokens ?? null
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
