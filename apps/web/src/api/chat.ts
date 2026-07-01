import type { ChatStreamPayload } from '@tavern/shared';

import { toApiUrl } from './http';

export type StartChatStreamOptions = {
  signal?: AbortSignal;
};

export class ChatStreamHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'CHAT_STREAM_HTTP_ERROR'
  ) {
    super(message);
    this.name = 'ChatStreamHttpError';
  }
}

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

  if (!response.ok) {
    const error = await toErrorInfo(response);

    throw new ChatStreamHttpError(error.message, response.status, error.code);
  }

  return response;
}

async function toErrorInfo(response: Response): Promise<{ code: string; message: string }> {
  try {
    const parsed = (await response.clone().json()) as {
      error?: {
        message?: unknown;
        code?: unknown;
      };
      message?: unknown;
    };

    if (typeof parsed.error?.message === 'string') {
      return {
        code: typeof parsed.error.code === 'string' ? parsed.error.code : 'CHAT_STREAM_HTTP_ERROR',
        message: parsed.error.message
      };
    }

    if (typeof parsed.message === 'string') {
      return {
        code: 'CHAT_STREAM_HTTP_ERROR',
        message: parsed.message
      };
    }
  } catch {
    // Fall back to status text below when the response is not JSON.
  }

  return {
    code: 'CHAT_STREAM_HTTP_ERROR',
    message: response.statusText || `Chat stream request failed with HTTP ${response.status}.`
  };
}
