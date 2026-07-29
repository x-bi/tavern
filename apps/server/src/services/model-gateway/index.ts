/**
 * Model Gateway 桶文件：重新导出网关核心类和类型。
 */
export { ModelGatewayError } from './model-gateway.error';
export { ModelGatewayModule } from './model-gateway.module';
export { ModelGatewayRegistry } from './model-gateway.registry';
export { ModelGatewayService } from './model-gateway.service';
export { OpenAICompatibleProvider } from './providers/openai-compatible';
export type {
  ModelGatewayChatResult,
  ModelGatewayConnectionTestResult,
  ModelGatewayMessage,
  ModelGatewayMessageRole,
  ModelGatewayProviderOptions,
  ModelGatewayRequestOptions,
  ModelGatewayRequestSource,
  ModelGatewayStreamDeltaEvent,
  ModelGatewayStreamDoneEvent,
  ModelGatewayStreamErrorEvent,
  ModelGatewayStreamEvent,
  ModelGatewayStreamPingEvent,
  ModelGatewayTokenUsage,
  GeneratedImageOutput,
  ImageGenerationOptions,
  ImageGenerationRequest,
  ImageGenerationResult,
  ModelProviderAdapter,
  ModelProviderRegistry
} from './types';
