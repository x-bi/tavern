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

/**
 * OpenAI 兼容供应商适配器：调用 OpenAI 兼容的 Chat Completions 接口。
 *
 * 实现 ModelProviderAdapter 接口，提供 testConnection / chat / streamChat 三类调用。
 * 在模块初始化时把自己注册到 ModelGatewayRegistry（含多个别名）。
 *
 * 设计要点：
 * - 超时控制：AbortController + timeout，超时抛 MODEL_GATEWAY_TIMEOUT；
 * - 请求/响应原日志：脱敏 apiKey 后写 data/model-gateway-raw.jsonl（诊断用）；
 * - SSE 流式解析：按 `\n\n` 分帧、提取 data: 行、JSON 解析；
 * - 错误归一化：网络错误/超时/HTTP 错误/响应解析错误统一转成 ModelGatewayError；
 * - apiKey 脱敏：响应文本和日志中替换 apiKey / Bearer token / sk- 开头密钥。
 */
@Injectable()
export class OpenAICompatibleProvider implements ModelProviderAdapter, OnModuleInit {
  readonly providerName = OPENAI_COMPATIBLE_PROVIDER_NAME;
  readonly providerAliases = OPENAI_COMPATIBLE_PROVIDER_ALIASES;

  constructor(
    @Inject(ModelGatewayRegistry)
    private readonly registry: ModelGatewayRegistry
  ) {}

  /** 模块初始化时把自己注册到注册表。 */
  onModuleInit(): void {
    this.registry.register(this);
  }

  /**
   * 测试连接：发一个 maxTokens=1 的最小请求，看能否收到响应。
   * @param config 请求配置。
   * @returns 连接测试结果（ok/延迟/状态码/摘要）；apiKey 未配置直接返回失败。
   */
  async testConnection(
    config: ModelGatewayRequestOptions
  ): Promise<ModelGatewayConnectionTestResult> {
    // 开始时间（算延迟）
    const startedAt = Date.now();
    // 基础结果（供应商/模型/baseUrl/测试时间，各分支共用）
    const baseResult = {
      providerName: config.providerName,
      modelName: config.modelName,
      baseUrl: config.baseUrl,
      testedAt: new Date().toISOString()
    };

    // 未配 apiKey：直接返回失败，不发请求
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
      // 发一个 maxTokens=1 的最小请求测试连接
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
        // 原始响应体写日志（脱敏 apiKey）
        this.writeRawResponseBodyLog(
          result.requestId,
          result.requestSource,
          responseText,
          config.apiKey
        );
      } finally {
        result.cleanup();
      }

      const latencyMs = Date.now() - startedAt;

      // HTTP 非 ok：连接失败，提取供应商错误摘要
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

      // 成功：提取响应摘要
      return {
        ...baseResult,
        ok: true,
        latencyMs,
        statusCode: response.status,
        message: '连接成功，已收到最小模型响应。',
        summary: this.extractSuccessSummary(responseText)
      };
    } catch (error) {
      // 异常（超时/网络）：转成失败结果，不抛错
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

  /**
   * 非流式聊天：发请求 → 取响应文本 → 解析成结果。
   * @param messages 消息序列。
   * @param options 请求选项。
   * @returns 聊天结果。
   * @throws ModelGatewayError 请求失败/超时/响应解析错误。
   */
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
      // 原始响应体写日志（脱敏）
      this.writeRawResponseBodyLog(
        result.requestId,
        result.requestSource,
        responseText,
        options.apiKey
      );
    } catch (error) {
      // 读取响应体失败：归一化错误后抛出
      throw this.normalizeRequestError(error, this.resolveTimeoutMs(options.timeout));
    } finally {
      result.cleanup();
    }

    // HTTP 非 ok：转成请求失败错误
    if (!response.ok) {
      throw this.toRequestFailedError(response.status, responseText, options);
    }

    // 解析响应并转成结果
    return this.toChatResult(this.parseJsonResponse(responseText, options), options);
  }

  /**
   * 流式聊天：发 stream 请求 → 逐帧解析 SSE → yield delta/done/error 事件。
   *
   * 流程：发请求 → 响应非 ok 转 error → 读 SSE 流逐帧解析 →
   * 提取 delta 文本 yield → 收到 [DONE] 或流结束 yield done → 异常 yield error。
   *
   * @param messages 消息序列。
   * @param options 请求选项。
   * @returns 流式事件异步迭代器。
   */
  async *streamChat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): AsyncIterable<ModelGatewayStreamEvent> {
    let result: OpenAICompatibleHttpResult;

    // 1. 发请求（失败直接 yield error）
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

    // 2. HTTP 非 ok：读响应体转 error 事件
    if (!response.ok) {
      const responseText = await response.text();
      this.writeRawResponseBodyLog(
        result.requestId,
        result.requestSource,
        responseText,
        options.apiKey
      );
      yield this.toStreamErrorEvent(
        this.toRequestFailedError(response.status, responseText, options),
        options
      );
      result.cleanup();
      return;
    }

    // 3. 无响应体：返回 invalid response
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

    // 累积状态：全文内容、finishReason、模型名、响应 ID、usage
    let content = '';
    let finishReason: string | null = null;
    let responseModel: string | null = null;
    let responseId: string | null = null;
    let usage: OpenAICompatibleUsage | null = null;
    let index = 0;

    try {
      // 4. 逐帧读取 SSE 流
      for await (const payload of this.readSseJsonPayloads(response.body, {
        requestId: result.requestId,
        requestSource: result.requestSource,
        apiKey: options.apiKey
      })) {
        // [DONE] 标记流结束
        if (payload === '[DONE]') {
          break;
        }

        const parsed = this.parseSsePayload(payload, options);

        // 帧含 error：转 error 事件并结束
        if (parsed.error) {
          yield {
            type: 'error',
            code: ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
            message: this.toProviderErrorMessage(parsed.error, options.apiKey),
            retryable: false
          };
          return;
        }

        // 累积响应元数据（模型名/响应ID/usage/finishReason）
        responseModel = typeof parsed.model === 'string' ? parsed.model : responseModel;
        responseId = typeof parsed.id === 'string' ? parsed.id : responseId;
        usage = this.toUsage(parsed.usage) ?? usage;
        finishReason = parsed.finish_reason ?? finishReason;

        // 顶层直接文本（部分供应商直接返回 text 字段）
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

        // choices 里的 delta 文本（标准 OpenAI 格式）
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

          // choice 级别的 finishReason
          if (choice.finish_reason !== undefined) {
            finishReason = choice.finish_reason;
          }
        }
      }

      // 5. 流结束但无内容：返回 invalid response
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

      // 6. yield done 事件（含累积的全文和元数据）
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
      // 流处理异常：归一化错误转 error 事件
      yield this.toStreamErrorEvent(
        this.normalizeRequestError(error, this.resolveTimeoutMs(options.timeout)),
        options
      );
    } finally {
      result.cleanup();
    }
  }

  /**
   * 发送 Chat Completions 请求（流式/非流式共用）。
   *
   * 流程：构造超时 controller + 转发上游中断信号 → 写请求日志 + 记录调用开始 →
   * fetch → 记录响应/失败日志 → 返回响应 + cleanup。
   *
   * @param options 请求选项（含 operation）。
   * @param messages 消息序列。
   * @param stream 是否流式。
   * @returns HTTP 结果（响应 + 请求 ID + cleanup）。
   * @throws ModelGatewayError 请求失败/超时。
   */
  private async postChatCompletions(
    options: OpenAICompatibleRequestOptions,
    messages: ModelGatewayMessage[],
    stream: boolean
  ): Promise<OpenAICompatibleHttpResult> {
    const timeoutMs = this.resolveTimeoutMs(options.timeout);
    // 超时 controller：到点自动 abort 请求
    const controller = new AbortController();
    const upstreamSignal = options.signal;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const requestId = options.requestId ?? randomUUID();
    const url = this.toChatCompletionsUrl(options.baseUrl);
    const headers = this.buildHeaders(options, stream);
    const requestBody = this.buildRequestBody(options, messages, stream);
    // 上游中断（如客户端断连）转发到本 controller
    const abortFromUpstream = (): void => controller.abort();
    // cleanup：清理超时定时器 + 移除上游监听
    const cleanup = (): void => {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    };

    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    // 写请求原日志（脱敏 headers/body）
    this.writeRawLog({
      type: 'request',
      requestId,
      at: new Date().toISOString(),
      operation: options.operation,
      requestSource: options.requestSource,
      providerName: options.providerName,
      modelName: options.modelName,
      stream,
      method: 'POST',
      url,
      headers: this.sanitizeHeaders(headers, options.apiKey),
      body: this.sanitizeLogValue(requestBody, options.apiKey)
    });
    // 记录调用开始（供调用统计）
    this.recordCall({
      providerName: options.providerName,
      modelName: options.modelName,
      operation: options.operation,
      requestSource: options.requestSource,
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

      // 记录调用结果（succeeded/failed + 状态码 + 延迟）
      this.recordCall({
        providerName: options.providerName,
        modelName: options.modelName,
        operation: options.operation,
        requestSource: options.requestSource,
        status: response.ok ? 'succeeded' : 'failed',
        statusCode: response.status,
        latencyMs: Date.now() - startedAt
      });
      // 写响应起始日志（状态/headers/延迟）
      this.writeRawLog({
        type: 'response-start',
        requestId,
        at: new Date().toISOString(),
        operation: options.operation,
        requestSource: options.requestSource,
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
        requestSource: options.requestSource,
        cleanup
      };
    } catch (error) {
      // fetch 抛错：记录失败 + 清理 + 归一化错误
      this.recordCall({
        providerName: options.providerName,
        modelName: options.modelName,
        operation: options.operation,
        requestSource: options.requestSource,
        status: 'failed'
      });
      this.writeRawLog({
        type: 'request-error',
        requestId,
        at: new Date().toISOString(),
        operation: options.operation,
        requestSource: options.requestSource,
        providerName: options.providerName,
        modelName: options.modelName,
        message: this.sanitizeProviderText(
          error instanceof Error && error.message ? error.message : 'Model request failed.',
          options.apiKey
        )
      });
      cleanup();
      throw this.normalizeRequestError(error, timeoutMs);
    }
  }

  /**
   * 构造请求体（model/messages/参数，可选字段有值才写入）。
   * @param options 请求选项。
   * @param messages 消息序列。
   * @param stream 是否流式。
   * @returns OpenAI 兼容请求体。
   */
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
      ...(typeof options.frequencyPenalty === 'number'
        ? { frequency_penalty: options.frequencyPenalty }
        : {}),
      ...(typeof options.presencePenalty === 'number'
        ? { presence_penalty: options.presencePenalty }
        : {}),
      ...(typeof options.maxTokens === 'number' && Number.isInteger(options.maxTokens)
        ? { max_tokens: options.maxTokens }
        : {}),
      ...(options.stop && options.stop.length > 0 ? { stop: options.stop } : {}),
      stream
    };
  }

  /**
   * 构造请求头（Content-Type + Accept + Authorization）。
   * @param options 请求选项。
   * @param stream 是否流式（影响 Accept）。
   * @returns 请求头对象。
   */
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

  /** 网关消息 → OpenAI 兼容消息（snake_case 字段名）。 */
  private toOpenAIMessage(message: ModelGatewayMessage): OpenAICompatibleMessage {
    return {
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {})
    };
  }

  /**
   * 拼 Chat Completions URL：去尾部斜杠，未以 /chat/completions 结尾则补上。
   * @param baseUrl 配置的 baseUrl。
   * @returns 完整请求 URL。
   */
  private toChatCompletionsUrl(baseUrl: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');

    return normalizedBaseUrl.endsWith('/chat/completions')
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/chat/completions`;
  }

  /**
   * 非流式响应 → 聊天结果（取首个 choice 内容、finishReason、usage）。
   * @param response 解析后的响应。
   * @param options 请求选项。
   * @returns 聊天结果。
   */
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

  /**
   * 读取 SSE 流并逐帧 yield JSON payload 字符串。
   *
   * 流程：读流 → 累积 buffer → 按空行分帧 → 提取 data: → yield。
   * 流结束时处理残余 buffer。
   *
   * @param body 响应流。
   * @param logContext 日志上下文（请求 ID + apiKey，用于脱敏日志）。
   * @returns payload 字符串异步迭代器。
   */
  private async *readSseJsonPayloads(
    body: ReadableStream<Uint8Array>,
    logContext: {
      requestId: string;
      requestSource: ModelGatewayRequestOptions['requestSource'];
      apiKey?: string | null;
    }
  ): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    // buffer 累积未分帧的文本；emittedPayload 标记是否已 yield 过 payload
    let buffer = '';
    let emittedPayload = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        // 流读完
        if (done) {
          break;
        }

        // 解码当前 chunk（stream:true 保留跨 chunk 的多字节字符）
        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;
        // 当前 chunk 写原日志（脱敏）
        this.writeRawResponseChunkLog(
          logContext.requestId,
          logContext.requestSource,
          decodedChunk,
          logContext.apiKey
        );

        // 按空行分帧（SSE 帧以空行分隔）；pop 取出最后不完整的部分留 buffer
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';

        // 逐帧提取 data: 内容并 yield
        for (const frame of frames) {
          const payload = this.extractSseData(frame);

          if (payload) {
            emittedPayload = true;
            yield payload;
          }
        }
      }

      // 流结束：flush decoder 残余 + 处理 buffer 残余
      buffer += decoder.decode();

      if (buffer.trim()) {
        const payload = this.extractSseData(buffer);

        if (payload) {
          emittedPayload = true;
          yield payload;
        } else if (!emittedPayload) {
          // 一个完整帧都没 yield 过：把残余 buffer 直接 yield（容错）
          yield buffer.trim();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** 从单帧提取 data: 行内容并拼接（多行 data 合并）。 */
  private extractSseData(frame: string): string | null {
    const data = frame
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    return data.length > 0 ? data : null;
  }

  /**
   * 解析非流式响应 JSON；含 error 字段则抛错。
   * @param responseText 响应文本。
   * @param options 请求选项。
   * @returns 解析后的响应。
   * @throws ModelGatewayError 响应含 error 或非合法 JSON。
   */
  private parseJsonResponse(
    responseText: string,
    options: ModelGatewayRequestOptions
  ): OpenAICompatibleChatResponse {
    try {
      const parsed = JSON.parse(responseText) as OpenAICompatibleChatResponse;

      // 响应含 error 字段：转成请求失败错误
      if (parsed.error) {
        throw new ModelGatewayError(
          ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
          this.toProviderErrorMessage(parsed.error, options.apiKey)
        );
      }

      return parsed;
    } catch (error) {
      // 已经是 ModelGatewayError：原样抛出
      if (error instanceof ModelGatewayError) {
        throw error;
      }

      // JSON 解析失败：转成 invalid response 错误
      throw new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
        '模型服务返回了无法解析的 JSON 响应。'
      );
    }
  }

  /**
   * 解析单帧 SSE payload 为响应对象。
   * @param payload payload 字符串。
   * @param options 请求选项。
   * @returns 解析后的响应。
   * @throws ModelGatewayError payload 非合法 JSON。
   */
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

  /**
   * 构造 HTTP 请求失败错误（含状态码和供应商摘要）。
   * @param statusCode HTTP 状态码。
   * @param responseText 响应文本。
   * @param options 请求选项。
   * @returns ModelGatewayError。
   */
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

  /**
   * 归一化请求错误：ModelGatewayError 原样返回；AbortError 转超时；其它转请求失败。
   * @param error 原始错误。
   * @param timeoutMs 超时毫秒（错误信息用）。
   * @returns 归一化后的错误。
   */
  private normalizeRequestError(error: unknown, timeoutMs: number): Error {
    // 已是网关错误：原样返回
    if (error instanceof ModelGatewayError) {
      return error;
    }

    // 中断错误（超时/客户端断连）：转超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      return new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_TIMEOUT,
        `模型请求超时：超过 ${timeoutMs}ms 未收到响应。`
      );
    }

    // 其它错误：转请求失败
    return new ModelGatewayError(
      ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      error instanceof Error && error.message ? `模型请求失败：${error.message}` : '模型请求失败。'
    );
  }

  /**
   * 把错误转成流式 error 事件（超时错误标 retryable）。
   * @param error 原始错误。
   * @param options 请求选项。
   * @returns 流式 error 事件。
   */
  private toStreamErrorEvent(
    error: unknown,
    options: ModelGatewayRequestOptions
  ): ModelGatewayStreamEvent {
    // 网关错误：保留 code/message，超时错误标 retryable
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

    // 其它错误：转请求失败，不可重试
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

  /**
   * 提取失败响应摘要（供应商消息或原文本，脱敏后截断 500 字）。
   * @param responseText 响应文本。
   * @param apiKey 用于脱敏。
   * @returns 摘要，或 null。
   */
  private extractProviderSummary(responseText: string, apiKey: string | null | undefined): string | null {
    const rawSummary = this.tryExtractProviderMessage(responseText) ?? responseText;
    const sanitizedSummary = this.sanitizeProviderText(rawSummary, apiKey);

    return sanitizedSummary ? sanitizedSummary.slice(0, 500) : null;
  }

  /**
   * 提取成功响应摘要（model/id/choices 数量）。
   * @param responseText 响应文本。
   * @returns 摘要字符串。
   */
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

  /**
   * 尝试从响应 JSON 提取供应商错误消息（error.message 或顶层 message）。
   * @param responseText 响应文本。
   * @returns 消息，或 null。
   */
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

  /**
   * 把供应商错误体转成消息字符串（含 code/type，脱敏）。
   * @param error 供应商错误体。
   * @param apiKey 用于脱敏。
   * @returns 错误消息。
   */
  private toProviderErrorMessage(
    error: OpenAICompatibleProviderError,
    apiKey: string | null | undefined
  ): string {
    // 拼装 message/code/type 三部分（缺失用默认值），脱敏后返回
    const parts = [
      typeof error.message === 'string' ? error.message : '模型服务返回错误。',
      typeof error.code === 'string' ? `code=${error.code}` : null,
      typeof error.type === 'string' ? `type=${error.type}` : null
    ].filter(Boolean);

    return this.sanitizeProviderText(parts.join(' '), apiKey);
  }

  /** 提取响应直接文本（response.text 或 output.text）。 */
  private extractResponseText(response: OpenAICompatibleChatResponse): string {
    return response.text ?? response.output?.text ?? '';
  }

  /**
   * 脱敏供应商文本：替换 apiKey、Bearer token、sk- 开头密钥。
   * @param value 原始文本。
   * @param apiKey 用于构造替换正则。
   * @returns 脱敏后的文本。
   */
  private sanitizeProviderText(value: string, apiKey: string | null | undefined): string {
    // 步骤1：有 apiKey 时，把文本中出现的 apiKey 原值替换成 [api-key]
    const sanitizedValue = apiKey
      ? value.replace(new RegExp(this.escapeRegExp(apiKey), 'g'), '[api-key]')
      : value;

    // 步骤2：替换 Bearer token；步骤3：替换 sk- 开头的密钥
    return sanitizedValue
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [api-key]')
      .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-****')
      .trim();
  }

  /** 写响应体原日志（脱敏后截断）。 */
  private writeRawResponseBodyLog(
    requestId: string,
    requestSource: ModelGatewayRequestOptions['requestSource'],
    responseText: string,
    apiKey: string | null | undefined
  ): void {
    this.writeRawLog({
      type: 'response-body',
      requestId,
      requestSource,
      at: new Date().toISOString(),
      bodyText: this.truncateLogText(this.sanitizeProviderText(responseText, apiKey)),
      bodyLength: responseText.length
    });
  }

  /** 写响应分块原日志（脱敏后截断）。 */
  private writeRawResponseChunkLog(
    requestId: string,
    requestSource: ModelGatewayRequestOptions['requestSource'],
    chunkText: string,
    apiKey: string | null | undefined
  ): void {
    this.writeRawLog({
      type: 'response-chunk',
      requestId,
      requestSource,
      at: new Date().toISOString(),
      chunkText: this.truncateLogText(this.sanitizeProviderText(chunkText, apiKey)),
      chunkLength: chunkText.length
    });
  }

  /**
   * 写一条原日志到 jsonl 文件（诊断用，失败不影响模型调用）。
   * @param entry 日志条目。
   */
  private writeRawLog(entry: Record<string, unknown>): void {
    try {
      const logPath = this.resolveRawLogPath();

      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Raw logging is diagnostic only and must not break model calls.
    }
  }

  /**
   * 解析原日志文件路径：环境变量优先，否则用项目根 data 目录。
   * @returns 日志文件绝对路径。
   */
  private resolveRawLogPath(): string {
    if (process.env.MODEL_GATEWAY_RAW_LOG_PATH) {
      return resolve(process.env.MODEL_GATEWAY_RAW_LOG_PATH);
    }

    return join(this.resolveProjectRoot(), 'data', 'model-gateway-raw.jsonl');
  }

  /**
   * 解析项目根目录：cwd 在 apps/server 时上溯两级，否则用 INIT_CWD 或 cwd。
   * @returns 项目根绝对路径。
   */
  private resolveProjectRoot(): string {
    const cwd = process.cwd();

    if (basename(cwd) === 'server' && basename(dirname(cwd)) === 'apps') {
      return resolve(cwd, '..', '..');
    }

    return process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : cwd;
  }

  /** 脱敏请求头各值。 */
  private sanitizeHeaders(
    headers: Record<string, string>,
    apiKey: string | null | undefined
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, this.sanitizeProviderText(value, apiKey)])
    );
  }

  /** 递归脱敏原始日志值，确保完整 Prompt 中的密钥形态也不会落盘。 */
  private sanitizeLogValue(value: unknown, apiKey: string | null | undefined): unknown {
    if (typeof value === 'string') {
      return this.sanitizeProviderText(value, apiKey);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeLogValue(item, apiKey));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          /authorization|api[_-]?key|secret|password/i.test(key)
            ? '[redacted]'
            : this.sanitizeLogValue(item, apiKey)
        ])
      );
    }
    return value;
  }

  /** Headers 对象 → 普通对象。 */
  private headersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};

    headers.forEach((value, key) => {
      record[key] = value;
    });

    return record;
  }

  /** 截断日志文本（超长截断并标注总长度）。 */
  private truncateLogText(value: string): string {
    return value.length <= RAW_LOG_MAX_TEXT_LENGTH
      ? value
      : `${value.slice(0, RAW_LOG_MAX_TEXT_LENGTH)}...[truncated:${value.length}]`;
  }

  /**
   * 把连接测试的错误转成提示消息（超时/中断/网关错误/其它）。
   * @param error 原始错误。
   * @param timeoutMs 超时毫秒。
   * @returns 提示消息。
   */
  private toConnectionErrorMessage(error: unknown, timeoutMs: number): string {
    // 超时错误：转超时提示
    if (error instanceof ModelGatewayError && error.code === ERROR_CODES.MODEL_GATEWAY_TIMEOUT) {
      return `连接超时：超过 ${timeoutMs}ms 未收到响应。`;
    }

    // 中断错误（AbortError）：同超时处理
    if (error instanceof Error && error.name === 'AbortError') {
      return `连接超时：超过 ${timeoutMs}ms 未收到响应。`;
    }

    // 其它网关错误：用其 message
    if (error instanceof ModelGatewayError) {
      return error.message;
    }

    // 普通错误：转连接失败提示
    return error instanceof Error && error.message
      ? `连接失败：${error.message}`
      : '连接失败：无法访问模型服务。';
  }

  /** 把供应商 usage（snake_case）转成网关 usage（camelCase）。 */
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

  /** 解析超时毫秒：取传入值或默认值，限制在 1~最大值之间。 */
  private resolveTimeoutMs(timeout: number | null | undefined): number {
    return Math.min(
      Math.max(timeout ?? OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS, 1),
      OPENAI_COMPATIBLE_MAX_TIMEOUT_MS
    );
  }

  /** 转义正则特殊字符（用于把 apiKey 安全插入正则）。 */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** 记录调用日志（预留，当前空实现，未来接非敏感调用日志）。 */
  private recordCall(entry: OpenAICompatibleLogEntry): void {
    void entry;
    // Reserved for a future non-secret call log sink.
  }
}
