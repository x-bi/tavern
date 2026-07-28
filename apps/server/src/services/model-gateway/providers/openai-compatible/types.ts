import type {
  ModelGatewayMessage,
  ModelGatewayRequestOptions,
  ModelGatewayTokenUsage
} from '../../types';

/** OpenAI 兼容消息（字段名用 snake_case，符合 OpenAI API 规范）。 */
export type OpenAICompatibleMessage = Pick<ModelGatewayMessage, 'role' | 'content' | 'name'> & {
  tool_call_id?: string;
};

/** OpenAI 兼容聊天请求体。 */
export type OpenAICompatibleChatRequest = {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream: boolean;
};

/** OpenAI 兼容聊天响应的 choice（含非流式 message 和流式 delta）。 */
export type OpenAICompatibleChatChoice = {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
  };
  delta?: {
    role?: string;
    content?: string | null;
  };
  finish_reason?: string | null;
};

/** OpenAI 兼容聊天响应体（兼容多种供应商的字段差异）。 */
export type OpenAICompatibleChatResponse = {
  id?: string;
  model?: string;
  text?: string | null;
  finish_reason?: string | null;
  output?: {
    text?: string | null;
  } | null;
  choices?: OpenAICompatibleChatChoice[];
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
  error?: OpenAICompatibleProviderError;
};

/** 供应商返回的错误体（字段都是 unknown，按需提取）。 */
export type OpenAICompatibleProviderError = {
  message?: unknown;
  code?: unknown;
  type?: unknown;
};

/** 调用日志条目（记录每次调用的供应商/模型/操作/状态/耗时）。 */
export type OpenAICompatibleLogEntry = {
  providerName: string;
  modelName: string;
  operation: 'testConnection' | 'chat' | 'streamChat';
  requestSource: ModelGatewayRequestOptions['requestSource'];
  status: 'started' | 'succeeded' | 'failed';
  statusCode?: number | null;
  latencyMs?: number;
};

/** OpenAI 兼容请求选项：网关请求选项 + 操作类型（用于日志）。 */
export type OpenAICompatibleRequestOptions = ModelGatewayRequestOptions & {
  operation: OpenAICompatibleLogEntry['operation'];
};

/** HTTP 请求结果：响应 + 请求 ID + 清理函数（取消请求时调用）。 */
export type OpenAICompatibleHttpResult = {
  response: Response;
  requestId: string;
  requestSource: ModelGatewayRequestOptions['requestSource'];
  cleanup: () => void;
};

/** OpenAI 兼容用量统计（同 ModelGatewayTokenUsage）。 */
export type OpenAICompatibleUsage = ModelGatewayTokenUsage;
