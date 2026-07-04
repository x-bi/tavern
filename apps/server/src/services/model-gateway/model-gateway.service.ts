import { Inject, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { ModelGatewayError } from './model-gateway.error';
import { ModelGatewayRegistry } from './model-gateway.registry';
import type {
  ModelGatewayChatResult,
  ModelGatewayConnectionTestResult,
  ModelGatewayMessage,
  ModelGatewayRequestOptions,
  ModelGatewayStreamEvent
} from './types';

/**
 * 模型网关服务：按供应商名从注册表取适配器，委托执行 testConnection/chat/streamChat。
 *
 * 供应商未注册时：
 * - testConnection 返回失败结果（不抛错）；
 * - chat 抛 MODEL_GATEWAY_PROVIDER_UNSUPPORTED；
 * - streamChat yield 一个 error 事件。
 */
@Injectable()
export class ModelGatewayService {
  constructor(
    @Inject(ModelGatewayRegistry)
    private readonly registry: ModelGatewayRegistry
  ) {}

  /**
   * 测试模型连接：委托给对应供应商适配器。
   * @param config 请求配置（含供应商名、baseUrl、apiKey 等）。
   * @returns 连接测试结果；供应商未注册返回失败结果（不抛错）。
   */
  async testConnection(
    config: ModelGatewayRequestOptions
  ): Promise<ModelGatewayConnectionTestResult> {
    const startedAt = Date.now();
    const adapter = this.registry.get(config.providerName);

    if (!adapter) {
      return this.toUnsupportedProviderTestResult(config, startedAt);
    }

    return adapter.testConnection(config);
  }

  /**
   * 非流式聊天：委托给对应供应商适配器。
   * @param messages 消息序列。
   * @param options 请求选项。
   * @returns 聊天结果。
   * @throws ModelGatewayError 供应商未注册。
   */
  async chat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): Promise<ModelGatewayChatResult> {
    const adapter = this.registry.get(options.providerName);

    if (!adapter) {
      throw new ModelGatewayError(
        ERROR_CODES.MODEL_GATEWAY_PROVIDER_UNSUPPORTED,
        this.toUnsupportedProviderMessage(options.providerName)
      );
    }

    return adapter.chat(messages, options);
  }

  /**
   * 流式聊天：委托给对应供应商适配器，逐事件 yield。
   * @param messages 消息序列。
   * @param options 请求选项。
   * @returns 流式事件异步迭代器；供应商未注册时 yield 一个 error 事件。
   */
  async *streamChat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): AsyncIterable<ModelGatewayStreamEvent> {
    const adapter = this.registry.get(options.providerName);

    if (!adapter) {
      yield {
        type: 'error',
        code: ERROR_CODES.MODEL_GATEWAY_PROVIDER_UNSUPPORTED,
        message: this.toUnsupportedProviderMessage(options.providerName),
        retryable: false
      };
      return;
    }

    yield* adapter.streamChat(messages, options);
  }

  /**
   * 构造供应商未注册的连接测试失败结果。
   * @param config 请求配置。
   * @param startedAt 开始时间戳（算延迟）。
   * @returns 失败的测试结果。
   */
  private toUnsupportedProviderTestResult(
    config: ModelGatewayRequestOptions,
    startedAt: number
  ): ModelGatewayConnectionTestResult {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      providerName: config.providerName,
      modelName: config.modelName,
      baseUrl: config.baseUrl,
      statusCode: null,
      message: this.toUnsupportedProviderMessage(config.providerName),
      summary: null,
      testedAt: new Date().toISOString()
    };
  }

  /**
   * 构造供应商未注册的提示消息。
   * @param providerName 供应商名。
   * @returns 提示消息。
   */
  private toUnsupportedProviderMessage(providerName: string): string {
    return `Model provider "${providerName}" is not registered in Model Gateway.`;
  }
}
