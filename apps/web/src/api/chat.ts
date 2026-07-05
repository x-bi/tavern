import type {
  ChatStreamPayload,
  ChatSuggestionPayload,
  ChatSuggestionResult
} from '@tavern/shared';

import { requestJson, toApiUrl } from './http';

/** startChatStream 的请求选项。 */
export type StartChatStreamOptions = {
  /** 中止信号，用于取消流（用户手动停止时由 useChatStream 触发）。 */
  signal?: AbortSignal;
};

/**
 * 聊天流 HTTP 错误：发起 SSE 流请求时服务端返回非 2xx。
 *
 * 携带 HTTP 状态码与业务错误码，供 useChatStream 转成 ChatStreamErrorEvent。
 */
export class ChatStreamHttpError extends Error {
  constructor(
    message: string,
    /** HTTP 状态码。 */
    readonly status: number,
    /** 业务错误码，默认 CHAT_STREAM_HTTP_ERROR。 */
    readonly code = 'CHAT_STREAM_HTTP_ERROR'
  ) {
    super(message);
    this.name = 'ChatStreamHttpError';
  }
}

/**
 * 发起聊天流请求。POST /chat/stream（Accept: text/event-stream）。
 *
 * 与普通 JSON 请求不同：这里用原生 fetch 直接拿 Response，
 * 由调用方（useChatStream）读取 response.body 的 ReadableStream 自行解析 SSE 帧。
 * 不使用 EventSource，因为要携带 JSON 请求体。
 *
 * @param payload 聊天流入参（含会话 ID、用户消息或重新生成目标）。
 * @param options 请求选项，可传 AbortSignal 取消流。
 * @returns 未消费的 Response（含可读 body）；调用方负责解析 SSE。
 * @throws ChatStreamHttpError 服务端返回非 2xx 时抛出，错误信息从响应体解析。
 */
export async function startChatStream(
  payload: ChatStreamPayload,
  options: StartChatStreamOptions = {}
): Promise<Response> {
  const response = await fetch(toApiUrl('/chat/stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(payload),
    signal: options.signal
  });

  // 非 2xx：尝试从响应体解析统一错误结构的 message/code，再抛 ChatStreamHttpError
  if (!response.ok) {
    const error = await toErrorInfo(response);

    throw new ChatStreamHttpError(error.message, response.status, error.code);
  }

  return response;
}

/**
 * 生成用户下一轮候选发言。POST /chat/suggestions
 *
 * 返回的文本可直接填入聊天输入框，但不会自动发送。
 */
export async function fetchChatSuggestions(
  payload: ChatSuggestionPayload
): Promise<ChatSuggestionResult> {
  const response = await requestJson<ChatSuggestionResult>('/chat/suggestions', {
    method: 'POST',
    body: payload
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? '生成候选发言失败。');
  }

  return response.data;
}

/**
 * 从失败响应中尽力解析出错误码与描述。
 *
 * 优先读取后端统一响应结构里的 error.message/code；若响应不是 JSON
 * （如网关返回的纯文本错误），回退到 HTTP statusText。
 *
 * @param response 失败的 Response（已 clone 以便重复读取）。
 * @returns 错误码与描述。
 */
async function toErrorInfo(response: Response): Promise<{ code: string; message: string }> {
  try {
    const parsed = (await response.clone().json()) as {
      error?: {
        message?: unknown;
        code?: unknown;
      };
      message?: unknown;
    };

    // 优先取后端统一错误结构 ApiResponse.error
    if (typeof parsed.error?.message === 'string') {
      return {
        code: typeof parsed.error.code === 'string' ? parsed.error.code : 'CHAT_STREAM_HTTP_ERROR',
        message: parsed.error.message
      };
    }

    // 次选：部分错误响应直接把 message 放在顶层
    if (typeof parsed.message === 'string') {
      return {
        code: 'CHAT_STREAM_HTTP_ERROR',
        message: parsed.message
      };
    }
  } catch {
    // Fall back to status text below when the response is not JSON.
  }

  // 兜底：响应体不可解析，用 HTTP 状态文本
  return {
    code: 'CHAT_STREAM_HTTP_ERROR',
    message: response.statusText || `Chat stream request failed with HTTP ${response.status}.`
  };
}
