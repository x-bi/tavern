export type ModelGatewayMessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool';

export type ModelGatewayMessage = {
  role: ModelGatewayMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown> | null;
};

export type ModelGatewayProviderOptions = {
  providerName: string;
  baseUrl: string;
  modelName: string;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
  stop?: string[];
  metadata?: Record<string, unknown> | null;
};

export type ModelGatewayRequestOptions = ModelGatewayProviderOptions & {
  apiKey?: string | null;
  requestId?: string;
  signal?: AbortSignal;
};

export type ModelGatewayTokenUsage = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

export type ModelGatewayChatResult = {
  text: string;
  providerName: string;
  modelName: string;
  finishReason?: string | null;
  usage?: ModelGatewayTokenUsage | null;
  metadata?: Record<string, unknown> | null;
};

export type ModelGatewayConnectionTestResult = {
  ok: boolean;
  latencyMs: number;
  providerName: string;
  modelName: string;
  baseUrl: string;
  statusCode: number | null;
  message: string;
  summary: string | null;
  testedAt: string;
};

export type ModelGatewayStreamDeltaEvent = {
  type: 'delta';
  text: string;
  index?: number;
  metadata?: Record<string, unknown> | null;
};

export type ModelGatewayStreamDoneEvent = {
  type: 'done';
  result: ModelGatewayChatResult;
};

export type ModelGatewayStreamErrorEvent = {
  type: 'error';
  code: string;
  message: string;
  retryable?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ModelGatewayStreamPingEvent = {
  type: 'ping';
  at: string;
};

export type ModelGatewayStreamEvent =
  | ModelGatewayStreamDeltaEvent
  | ModelGatewayStreamDoneEvent
  | ModelGatewayStreamErrorEvent
  | ModelGatewayStreamPingEvent;

export interface ModelProviderAdapter {
  readonly providerName: string;
  readonly providerAliases?: string[];
  testConnection(config: ModelGatewayRequestOptions): Promise<ModelGatewayConnectionTestResult>;
  chat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): Promise<ModelGatewayChatResult>;
  streamChat(
    messages: ModelGatewayMessage[],
    options: ModelGatewayRequestOptions
  ): AsyncIterable<ModelGatewayStreamEvent>;
}

export interface ModelProviderRegistry {
  register(adapter: ModelProviderAdapter): void;
  get(providerName: string): ModelProviderAdapter | null;
  has(providerName: string): boolean;
  listProviderNames(): string[];
}
