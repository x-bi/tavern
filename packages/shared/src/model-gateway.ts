/** Model Gateway 内部消息的角色取值，覆盖 OpenAI 兼容的 role 集合。 */
export type ModelGatewayMessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool';

/** Model Gateway 传递给供应商的单条消息。 */
export type ModelGatewayMessage = {
  /** 消息角色。 */
  role: ModelGatewayMessageRole;
  /** 消息正文。 */
  content: string;
  /** 仅 role 为 tool/assistant 时使用，指明工具调用或调用结果归属。 */
  name?: string;
  /** role 为 tool 时，关联的工具调用 ID。 */
  toolCallId?: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 调用供应商所需的路由与参数选项（由 Model Gateway 消费）。 */
export type ModelGatewayProviderOptions = {
  /** 供应商标识。 */
  providerName: string;
  /** 模型 API 的基础 URL。 */
  baseUrl: string;
  /** 模型名。 */
  modelName: string;
  /** 采样温度；未设置时为 null，沿用模型默认。 */
  temperature?: number | null;
  /** topP（核采样）；未设置时为 null。 */
  topP?: number | null;
  /** 最大输出 token 数；未设置时为 null。 */
  maxTokens?: number | null;
  /** 请求超时时间（毫秒）；未设置时为 null。 */
  timeout?: number | null;
  /** 生成停止序列（命中任一即停止）。 */
  stop?: string[];
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 一次调用的 token 用量统计；各字段未统计时为 null。 */
export type ModelGatewayTokenUsage = {
  /** 输入（prompt）token 数。 */
  promptTokens?: number | null;
  /** 输出（completion）token 数。 */
  completionTokens?: number | null;
  /** 合计 token 数。 */
  totalTokens?: number | null;
};

/** 非流式调用的最终结果。 */
export type ModelGatewayChatResult = {
  /** 生成的完整文本。 */
  text: string;
  /** 使用的供应商标识。 */
  providerName: string;
  /** 使用的模型名。 */
  modelName: string;
  /** 结束原因（如 `stop`、`length`）；未知时为 null。 */
  finishReason?: string | null;
  /** token 用量统计；未提供时为 null。 */
  usage?: ModelGatewayTokenUsage | null;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 连通性测试结果（与 ModelConnectionTestResponse 同构，Model Gateway 内部使用）。 */
export type ModelGatewayConnectionTestResult = {
  /** 是否连通成功。 */
  ok: boolean;
  /** 探测往返耗时（毫秒）。 */
  latencyMs: number;
  /** 供应商标识。 */
  providerName: string;
  /** 模型名。 */
  modelName: string;
  /** 基础 URL。 */
  baseUrl: string;
  /** 供应商返回的 HTTP 状态码；未拿到响应时为 null。 */
  statusCode: number | null;
  /** 结果说明。 */
  message: string;
  /** 面向用户展示的简短摘要；无摘要时为 null。 */
  summary: string | null;
  /** 测试完成时间（ISO 字符串）。 */
  testedAt: string;
};

/** 流式事件：增量片段。 */
export type ModelGatewayStreamDeltaEvent = {
  /** 事件类型标识。 */
  type: 'delta';
  /** 本次增量文本。 */
  text: string;
  /** 多选项生成时的片段序号；单选项生成可不传。 */
  index?: number;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 流式事件：流正常结束。 */
export type ModelGatewayStreamDoneEvent = {
  /** 事件类型标识。 */
  type: 'done';
  /** 最终生成结果（含完整文本与用量）。 */
  result: ModelGatewayChatResult;
};

/** 流式事件：错误中断。 */
export type ModelGatewayStreamErrorEvent = {
  /** 事件类型标识。 */
  type: 'error';
  /** 业务错误码。 */
  code: string;
  /** 给人看的错误描述。 */
  message: string;
  /** 是否可重试；未提供时由调用方自行判断。 */
  retryable?: boolean;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 流式事件：心跳保活，无业务数据。 */
export type ModelGatewayStreamPingEvent = {
  /** 事件类型标识。 */
  type: 'ping';
  /** 心跳时间（ISO 字符串）。 */
  at: string;
};

/**
 * 流式事件联合类型。
 *
 * 一次流式调用按 `delta* → done` 的顺序产生事件，过程中可能出现 `ping` 保活，
 * 异常时产生 `error` 并结束流。
 */
export type ModelGatewayStreamEvent =
  | ModelGatewayStreamDeltaEvent
  | ModelGatewayStreamDoneEvent
  | ModelGatewayStreamErrorEvent
  | ModelGatewayStreamPingEvent;
