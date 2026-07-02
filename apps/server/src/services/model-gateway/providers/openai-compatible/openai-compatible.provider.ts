import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { appendFileSync, mkdirSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';

import { ERROR_CODES } from '../../../../common/dto/error-codes';
import { ModelGatewayError } from '../../model-gateway.error';
import { ModelGatewayRegistry } from '../../model-gateway.registry';
import type {
  ModelGatewayChatResult,
  ModelGatewayConnectionTestResult,
  ModelGatewayMessage,
  ModelGatewayRequestOptions,
  ModelGatewayStreamEvent,
  ModelProviderAdapter
} from '../../types';
import {
  OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS,
  OPENAI_COMPATIBLE_MAX_TIMEOUT_MS,
  OPENAI_COMPATIBLE_PROVIDER_ALIASES,
  OPENAI_COMPATIBLE_PROVIDER_NAME,
  OPENAI_COMPATIBLE_TEST_MAX_TOKENS
} from './constants';
import type {
  OpenAICompatibleChatRequest,
  OpenAICompatibleChatResponse,
  OpenAICompatibleHttpResult,
  OpenAICompatibleLogEntry,
  OpenAICompatibleMessage,
  OpenAICompatibleProviderError,
  OpenAICompatibleRequestOptions,
  OpenAICompatibleUsage
} from './types';

const RAW_LOG_MAX_TEXT_LENGTH = 120000;

@Injectable()
export class OpenAICompatibleProvider implements ModelProviderAdapter, OnModuleInit {
  readonly providerName = OPENAI_COMPATIBLE_PROVIDER_NAME;
  readonly providerAliases = OPENAI_COMPATIBLE_PROVIDER_ALIASES;

  constructor(
    @Inject(ModelGatewayRegistry)
    private readonly registry: ModelGatewayRegistry
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async testConnection(
    config: ModelGatewayRequestOptions
  ): Promise<ModelGatewayConnectionTestResult> {
    const startedAt = Date.now();
    const baseResult = {
      providerName: config.providerName,
      modelName: config.modelName,
      baseUrl: config.baseUrl,
      testedAt: new Date().toISOString()
    };

    if (!config.apiKey) {
      return {
        ...baseResult,
        ok: false,
        latencyMs: 0,
        statusCode: null,
        message: 'API Key 未配置，无法测试连接。',
        summary: null
      };
    }

    try {
      const result = await this.postChatCompletions(
        {
          ...config,
          operation: 'testConnection',
          temperature: 0,
          maxTokens: OPENAI_COMPATIBLE_TEST_MAX_TOKENS
        },
        [
          {
            role: 'user',
            content: 'ping'
          }
        ],
        false
      );
      const response = result.response;
      let responseText: string;

      try {
        responseText = await response.text();
        this.writeRawResponseBodyLog(result.requestId, responseText, config.apiKey);
      } finally {
        result.cleanup();
      }

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          ...baseResult,
          ok: false,
          latencyMs,
          statusCode: response.status,
          message: `连接失败：HTTP ${response.status}`,
          summary: this.extractProviderSummary(responseText, config.apiKey)
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
        message: this.toConnectionErrorMessage(error, this.resolveTimeoutMs(config.timeout)),
        summary: null
      };
    }
  }

  async chat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): Promise<ModelGatewayChatResult> {
    const result = await this.postChatCompletions(
      {
        ...options,
        operation: 'chat'
      },
      messages,
      false
    );
    const response = result.response;
    let responseText: string;

    try {
      responseText = await response.text();
      this.writeRawResponseBodyLog(result.requestId, responseText, options.apiKey);
    } catch (error) {
      throw this.normalizeRequestError(error, this.resolveTimeoutMs(options.timeout));
    } finally {
      result.cleanup();
    }

    if (!response.ok) {
      throw this.toRequestFailedError(response.status, responseText, options);
    }

    return this.toChatResult(this.parseJsonResponse(responseText, options), options);
  }

  async *streamChat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): AsyncIterable<ModelGatewayStreamEvent> {
    let result: OpenAICompatibleHttpResult;

    try {
      result = await this.postChatCompletions(
        {
          ...options,
          operation: 'streamChat'
        },
        messages,
        true
      );
    } catch (error) {
      yield this.toStreamErrorEvent(error, options);
      return;
    }

    const response = result.response;

    if (!response.ok) {
      const responseText = await response.text();
      this.writeRawResponseBodyLog(result.requestId, responseText, options.apiKey);
      yield this.toStreamErrorEvent(
        this.toRequestFailedError(response.status, responseText, options),
        options
      );
      result.cleanup();
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        code: ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
        message: '模型服务没有返回可读取的流式响应。',
        retryable: false
      };
      result.cleanup();
      return;
    }

    let content = '';
    let finishReason: string | null = null;
    let responseModel: string | null = null;
    let responseId: string | null = null;
    let usage: OpenAICompatibleUsage | null = null;
    let index = 0;

    try {
      for await (const payload of this.readSseJsonPayloads(response.body, {
        requestId: result.requestId,
        apiKey: options.apiKey
      })) {
        if (payload === '[DONE]') {
          break;
        }

        const parsed = this.parseSsePayload(payload, options);

        if (parsed.error) {
          yield {
            type: 'error',
            code: ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
            message: this.toProviderErrorMessage(parsed.error, options.apiKey),
            retryable: false
          };
          return;
        }

        responseModel = typeof parsed.model === 'string' ? parsed.model : responseModel;
        responseId = typeof parsed.id === 'string' ? parsed.id : responseId;
        usage = this.toUsage(parsed.usage) ?? usage;
        finishReason = parsed.finish_reason ?? finishReason;

        const directText = this.extractResponseText(parsed);

        if (directText) {
          content += directText;
          yield {
            type: 'delta',
            text: directText,
            index
          };
          index += 1;
        }

        for (const choice of parsed.choices ?? []) {
          const deltaText = choice.delta?.content ?? choice.message?.content ?? '';

          if (deltaText) {
            content += deltaText;
            yield {
              type: 'delta',
              text: deltaText,
              index
            };
            index += 1;
          }

          if (choice.finish_reason !== undefined) {
            finishReason = choice.finish_reason;
          }
        }
      }

      if (!content) {
        yield {
          type: 'error',
          code: ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
          message: '模型服务返回成功，但没有生成任何文本内容。',
          retryable: false,
          metadata: {
            providerName: options.providerName,
            modelName: options.modelName
          }
        };
        return;
      }

      yield {
        type: 'done',
        result: {
          text: content,
          providerName: options.providerName,
          modelName: responseModel ?? options.modelName,
          finishReason,
          usage,
          metadata: {
            provider: this.providerName,
            responseId
          }
        }
      };
    } catch (error) {
      yield this.toStreamErrorEvent(
        this.normalizeRequestError(error, this.resolveTimeoutMs(options.timeout)),
        options
      );
    } finally {
      result.cleanup();
    }
  }

  private async postChatCompletions(
    options: OpenAICompatibleRequestOptions,
    messages: ModelGatewayMessage[],
    stream: boolean
  ): Promise<OpenAICompatibleHttpResult> {
    const timeoutMs = this.resolveTimeoutMs(options.timeout);
    const controller = new AbortController();
    const upstreamSignal = options.signal;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const requestId = options.requestId ?? randomUUID();
    const url = this.toChatCompletionsUrl(options.baseUrl);
    const headers = this.buildHeaders(options, stream);
    const requestBody = this.buildRequestBody(options, messages, stream);
    const abortFromUpstream = (): void => controller.abort();
    const cleanup = (): void => {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    };

    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    this.writeRawLog({
      type: 'request',
      requestId,
      at: new Date().toISOString(),
      operation: options.operation,
      providerName: options.providerName,
      modelName: options.modelName,
      stream,
      method: 'POST',
      url,
      headers: this.sanitizeHeaders(headers, options.apiKey),
      body: requestBody
    });
    this.recordCall({
      providerName: options.providerName,
      modelName: options.modelName,
      operation: options.operation,
      status: 'started'
    });

    try {
      const startedAt = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      this.recordCall({
        providerName: options.providerName,
        modelName: options.modelName,
        operation: options.operation,
        status: response.ok ? 'succeeded' : 'failed',
        statusCode: response.status,
        latencyMs: Date.now() - startedAt
      });
      this.writeRawLog({
        type: 'response-start',
        requestId,
        at: new Date().toISOString(),
        operation: options.operation,
        providerName: options.providerName,
        modelName: options.modelName,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: this.headersToRecord(response.headers),
        latencyMs: Date.now() - startedAt
      });

      return {
        response,
        requestId,
        cleanup
      };
    } catch (error) {
      this.recordCall({
        providerName: options.providerName,
        modelName: options.modelName,
        operation: options.operation,
        status: 'failed'
      });
      this.writeRawLog({
        type: 'request-error',
        requestId,
        at: new Date().toISOString(),
        operation: options.operation,
        providerName: options.providerName,
        modelName: options.modelName,
        message: error instanceof Error && error.message ? error.message : 'Model request failed.'
      });
      cleanup();
      throw this.normalizeRequestError(error, timeoutMs);
    }
  }

  private buildRequestBody(
    options: ModelGatewayRequestOptions,
    messages: ModelGatewayMessage[],
    stream: boolean
  ): OpenAICompatibleChatRequest {
    return {
      model: options.modelName,
      messages: messages.map((message) => this.toOpenAIMessage(message)),
      ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
      ...(typeof options.topP === 'number' ? { top_p: options.topP } : {}),
      ...(typeof options.maxTokens === 'number' && Number.isInteger(options.maxTokens)
        ? { max_tokens: options.maxTokens }
        : {}),
      ...(options.stop && options.stop.length > 0 ? { stop: options.stop } : {}),
      stream
    };
  }

  private buildHeaders(
    options: ModelGatewayRequestOptions,
    stream: boolean
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {})
    };
  }

  private toOpenAIMessage(message: ModelGatewayMessage): OpenAICompatibleMessage {
    return {
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {})
    };
  }

  private toChatCompletionsUrl(baseUrl: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');

    return normalizedBaseUrl.endsWith('/chat/completions')
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/chat/completions`;
  }

  private toChatResult(
    response: OpenAICompatibleChatResponse,
    options: ModelGatewayRequestOptions
  ): ModelGatewayChatResult {
    const firstChoice = response.choices?.[0];
    const text = firstChoice?.message?.content ?? this.extractResponseText(response);

    return {
      text,
      providerName: options.providerName,
      modelName: typeof response.model === 'string' ? response.model : options.modelName,
      finishReason: firstChoice?.finish_reason ?? response.finish_reason ?? null,
      usage: this.toUsage(response.usage),
      metadata: {
        provider: this.providerName,
        responseId: typeof response.id === 'string' ? response.id : null
      }
    };
  }

  private async *readSseJsonPayloads(
    body: ReadableStream<Uint8Array>,
    logContext: {
      requestId: string;
      apiKey?: string | null;
    }
  ): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let emittedPayload = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;
        this.writeRawResponseChunkLog(logContext.requestId, decodedChunk, logContext.apiKey);

        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const payload = this.extractSseData(frame);

          if (payload) {
            emittedPayload = true;
            yield payload;
          }
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        const payload = this.extractSseData(buffer);

        if (payload) {
          emittedPayload = true;
          yield payload;
        } else if (!emittedPayload) {
          yield buffer.trim();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private extractSseData(frame: string): string | null {
    const data = frame
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    return data.length > 0 ? data : null;
  }

  private parseJsonResponse(
    responseText: string,
    options: ModelGatewayRequestOptions
  ): OpenAICompatibleChatResponse {
    try {
      const parsed = JSON.parse(responseText) as OpenAICompatibleChatResponse;

      if (parsed.error) {
        throw new ModelGatewayError(
          ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
          this.toProviderErrorMessage(parsed.error, options.apiKey)
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof ModelGatewayError) {
        throw error;
      }

      throw new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
        '模型服务返回了无法解析的 JSON 响应。'
      );
    }
  }

  private parseSsePayload(
    payload: string,
    options: ModelGatewayRequestOptions
  ): OpenAICompatibleChatResponse {
    try {
      return JSON.parse(payload) as OpenAICompatibleChatResponse;
    } catch {
      throw new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
        '模型服务返回了无法解析的流式 JSON 片段。',
        {
          providerName: options.providerName,
          modelName: options.modelName
        }
      );
    }
  }

  private toRequestFailedError(
    statusCode: number,
    responseText: string,
    options: ModelGatewayRequestOptions
  ): ModelGatewayError {
    const providerSummary = responseText
      ? this.extractProviderSummary(responseText, options.apiKey)
      : null;

    return new ModelGatewayError(
      ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      `模型请求失败：HTTP ${statusCode}${providerSummary ? `，${providerSummary}` : ''}`,
      {
        statusCode,
        providerName: options.providerName,
        modelName: options.modelName
      }
    );
  }

  private normalizeRequestError(error: unknown, timeoutMs: number): Error {
    if (error instanceof ModelGatewayError) {
      return error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_TIMEOUT,
        `模型请求超时：超过 ${timeoutMs}ms 未收到响应。`
      );
    }

    return new ModelGatewayError(
      ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      error instanceof Error && error.message ? `模型请求失败：${error.message}` : '模型请求失败。'
    );
  }

  private toStreamErrorEvent(
    error: unknown,
    options: ModelGatewayRequestOptions
  ): ModelGatewayStreamEvent {
    if (error instanceof ModelGatewayError) {
      return {
        type: 'error',
        code: error.code,
        message: error.message,
        retryable: error.code === ERROR_CODES.MODEL_GATEWAY_TIMEOUT,
        metadata: {
          providerName: options.providerName,
          modelName: options.modelName,
          ...(error.details ?? {})
        }
      };
    }

    return {
      type: 'error',
      code: ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      message: error instanceof Error && error.message ? error.message : '模型流式请求失败。',
      retryable: false,
      metadata: {
        providerName: options.providerName,
        modelName: options.modelName
      }
    };
  }

  private extractProviderSummary(responseText: string, apiKey: string | null | undefined): string | null {
    const rawSummary = this.tryExtractProviderMessage(responseText) ?? responseText;
    const sanitizedSummary = this.sanitizeProviderText(rawSummary, apiKey);

    return sanitizedSummary ? sanitizedSummary.slice(0, 500) : null;
  }

  private extractSuccessSummary(responseText: string): string | null {
    if (!responseText) {
      return '响应体为空，但 HTTP 状态为成功。';
    }

    try {
      const parsed = JSON.parse(responseText) as OpenAICompatibleChatResponse;
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
        error?: OpenAICompatibleProviderError;
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

  private toProviderErrorMessage(
    error: OpenAICompatibleProviderError,
    apiKey: string | null | undefined
  ): string {
    const parts = [
      typeof error.message === 'string' ? error.message : '模型服务返回错误。',
      typeof error.code === 'string' ? `code=${error.code}` : null,
      typeof error.type === 'string' ? `type=${error.type}` : null
    ].filter(Boolean);

    return this.sanitizeProviderText(parts.join(' '), apiKey);
  }

  private extractResponseText(response: OpenAICompatibleChatResponse): string {
    return response.text ?? response.output?.text ?? '';
  }

  private sanitizeProviderText(value: string, apiKey: string | null | undefined): string {
    const sanitizedValue = apiKey
      ? value.replace(new RegExp(this.escapeRegExp(apiKey), 'g'), '[api-key]')
      : value;

    return sanitizedValue
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [api-key]')
      .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-****')
      .trim();
  }

  private writeRawResponseBodyLog(
    requestId: string,
    responseText: string,
    apiKey: string | null | undefined
  ): void {
    this.writeRawLog({
      type: 'response-body',
      requestId,
      at: new Date().toISOString(),
      bodyText: this.truncateLogText(this.sanitizeProviderText(responseText, apiKey)),
      bodyLength: responseText.length
    });
  }

  private writeRawResponseChunkLog(
    requestId: string,
    chunkText: string,
    apiKey: string | null | undefined
  ): void {
    this.writeRawLog({
      type: 'response-chunk',
      requestId,
      at: new Date().toISOString(),
      chunkText: this.truncateLogText(this.sanitizeProviderText(chunkText, apiKey)),
      chunkLength: chunkText.length
    });
  }

  private writeRawLog(entry: Record<string, unknown>): void {
    try {
      const logPath = this.resolveRawLogPath();

      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Raw logging is diagnostic only and must not break model calls.
    }
  }

  private resolveRawLogPath(): string {
    if (process.env.MODEL_GATEWAY_RAW_LOG_PATH) {
      return resolve(process.env.MODEL_GATEWAY_RAW_LOG_PATH);
    }

    return join(this.resolveProjectRoot(), 'data', 'model-gateway-raw.jsonl');
  }

  private resolveProjectRoot(): string {
    const cwd = process.cwd();

    if (basename(cwd) === 'server' && basename(dirname(cwd)) === 'apps') {
      return resolve(cwd, '..', '..');
    }

    return process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : cwd;
  }

  private sanitizeHeaders(
    headers: Record<string, string>,
    apiKey: string | null | undefined
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, this.sanitizeProviderText(value, apiKey)])
    );
  }

  private headersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};

    headers.forEach((value, key) => {
      record[key] = value;
    });

    return record;
  }

  private truncateLogText(value: string): string {
    return value.length <= RAW_LOG_MAX_TEXT_LENGTH
      ? value
      : `${value.slice(0, RAW_LOG_MAX_TEXT_LENGTH)}...[truncated:${value.length}]`;
  }

  private toConnectionErrorMessage(error: unknown, timeoutMs: number): string {
    if (error instanceof ModelGatewayError && error.code === ERROR_CODES.MODEL_GATEWAY_TIMEOUT) {
      return `连接超时：超过 ${timeoutMs}ms 未收到响应。`;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return `连接超时：超过 ${timeoutMs}ms 未收到响应。`;
    }

    if (error instanceof ModelGatewayError) {
      return error.message;
    }

    return error instanceof Error && error.message
      ? `连接失败：${error.message}`
      : '连接失败：无法访问模型服务。';
  }

  private toUsage(
    usage: OpenAICompatibleChatResponse['usage'] | undefined
  ): OpenAICompatibleUsage | null {
    if (!usage) {
      return null;
    }

    return {
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null
    };
  }

  private resolveTimeoutMs(timeout: number | null | undefined): number {
    return Math.min(
      Math.max(timeout ?? OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS, 1),
      OPENAI_COMPATIBLE_MAX_TIMEOUT_MS
    );
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private recordCall(_entry: OpenAICompatibleLogEntry): void {
    // Reserved for a future non-secret call log sink.
  }
}
