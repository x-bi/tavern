/** 模型网关消息角色（含 developer，OpenAI 兼容）。 */
export type ModelGatewayMessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool';

/** 模型网关消息（发给供应商的消息）。 */
export type ModelGatewayMessage = {
  role: ModelGatewayMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown> | null;
};

/** 供应商调用选项（不含 apiKey，由 RequestOptions 扩展）。 */
export type ModelGatewayProviderOptions = {
  providerName: string;
  baseUrl: string;
  modelName: string;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  /** 频率惩罚（0~2），抑制已出现 token 重复。 */
  frequencyPenalty?: number | null;
  /** 存在惩罚（0~2），鼓励引入新内容。 */
  presencePenalty?: number | null;
  timeout?: number | null;
  stop?: string[];
  metadata?: Record<string, unknown> | null;
};

/** 请求选项：供应商选项 + apiKey + 请求标识 + 中断信号。 */
export type ModelGatewayRequestOptions = ModelGatewayProviderOptions & {
  apiKey?: string | null;
  requestId?: string;
  signal?: AbortSignal;
};

/** token 用量统计。 */
export type ModelGatewayTokenUsage = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

/** 非流式聊天结果。 */
export type ModelGatewayChatResult = {
  text: string;
  providerName: string;
  modelName: string;
  finishReason?: string | null;
  usage?: ModelGatewayTokenUsage | null;
  metadata?: Record<string, unknown> | null;
};

/** 连接测试结果。 */
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

/** 流式增量事件（模型输出一段文本）。 */
export type ModelGatewayStreamDeltaEvent = {
  type: 'delta';
  text: string;
  index?: number;
  metadata?: Record<string, unknown> | null;
};

/** 流式完成事件。 */
export type ModelGatewayStreamDoneEvent = {
  type: 'done';
  result: ModelGatewayChatResult;
};

/** 流式错误事件。 */
export type ModelGatewayStreamErrorEvent = {
  type: 'error';
  code: string;
  message: string;
  retryable?: boolean;
  metadata?: Record<string, unknown> | null;
};

/** 流式心跳事件。 */
export type ModelGatewayStreamPingEvent = {
  type: 'ping';
  at: string;
};

/** 流式事件联合。 */
export type ModelGatewayStreamEvent =
  | ModelGatewayStreamDeltaEvent
  | ModelGatewayStreamDoneEvent
  | ModelGatewayStreamErrorEvent
  | ModelGatewayStreamPingEvent;

/**
 * 模型供应商适配器接口：每个供应商实现一套（testConnection/chat/streamChat）。
 * 注册到 ModelGatewayRegistry 后，由 ModelGatewayService 按供应商名分发。
 */
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

/** 供应商注册表接口。 */
export interface ModelProviderRegistry {
  register(adapter: ModelProviderAdapter): void;
  get(providerName: string): ModelProviderAdapter | null;
  has(providerName: string): boolean;
  listProviderNames(): string[];
}
