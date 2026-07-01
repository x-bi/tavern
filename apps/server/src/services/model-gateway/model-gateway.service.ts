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

@Injectable()
export class ModelGatewayService {
  constructor(
    @Inject(ModelGatewayRegistry)
    private readonly registry: ModelGatewayRegistry
  ) {}

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

  private toUnsupportedProviderMessage(providerName: string): string {
    return `Model provider "${providerName}" is not registered in Model Gateway.`;
  }
}
