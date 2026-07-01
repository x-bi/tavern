import { computed, readonly, ref } from 'vue';
import type {
  ChatStreamDeltaEvent,
  ChatStreamDoneEvent,
  ChatStreamErrorEvent,
  ChatStreamPayload
} from '@tavern/shared';

import { ChatStreamHttpError, startChatStream } from '../api/chat';

export type ChatStreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'aborted';

export type ChatStreamEventName = 'delta' | 'done' | 'error';

export type ChatStreamEvent =
  | {
      event: 'delta';
      data: ChatStreamDeltaEvent;
    }
  | {
      event: 'done';
      data: ChatStreamDoneEvent;
    }
  | {
      event: 'error';
      data: ChatStreamErrorEvent;
    };

export type ChatStreamCallbacks = {
  onDelta?: (event: ChatStreamDeltaEvent) => void;
  onDone?: (event: ChatStreamDoneEvent) => void;
  onError?: (event: ChatStreamErrorEvent) => void;
  onEvent?: (event: ChatStreamEvent) => void;
};

type SseFrame = {
  event: string;
  data: string;
};

const CLIENT_ABORT_ERROR: ChatStreamErrorEvent = {
  code: 'CHAT_STREAM_ABORTED',
  message: 'Chat stream aborted.'
};

export function useChatStream() {
  const status = ref<ChatStreamStatus>('idle');
  const error = ref<ChatStreamErrorEvent | null>(null);
  const controller = ref<AbortController | null>(null);
  const isStreaming = computed(() => status.value === 'connecting' || status.value === 'streaming');

  async function startStream(
    payload: ChatStreamPayload,
    callbacks: ChatStreamCallbacks = {}
  ): Promise<void> {
    abort();

    const abortController = new AbortController();
    controller.value = abortController;
    status.value = 'connecting';
    error.value = null;

    try {
      const response = await startChatStream(payload, {
        signal: abortController.signal
      });

      if (!response.body) {
        throw new Error('Chat stream response body is not readable.');
      }

      status.value = 'streaming';
      await readEventStream(response.body, callbacks);

      if (abortController.signal.aborted) {
        status.value = 'aborted';
        error.value = CLIENT_ABORT_ERROR;
        callbacks.onError?.(CLIENT_ABORT_ERROR);
        callbacks.onEvent?.({
          event: 'error',
          data: CLIENT_ABORT_ERROR
        });
      } else if ((status.value as ChatStreamStatus) !== 'error') {
        status.value = 'done';
      }
    } catch (caughtError) {
      const normalizedError = toStreamError(caughtError);

      error.value = normalizedError;
      status.value = normalizedError.code === CLIENT_ABORT_ERROR.code ? 'aborted' : 'error';
      callbacks.onError?.(normalizedError);
      callbacks.onEvent?.({
        event: 'error',
        data: normalizedError
      });
    } finally {
      if (controller.value === abortController) {
        controller.value = null;
      }
    }
  }

  function abort(): boolean {
    if (!controller.value) {
      return false;
    }

    controller.value.abort();
    status.value = 'aborted';
    error.value = CLIENT_ABORT_ERROR;

    return true;
  }

  async function readEventStream(
    stream: ReadableStream<Uint8Array>,
    callbacks: ChatStreamCallbacks
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = consumeFrames(buffer, callbacks);
      }

      buffer += decoder.decode();
      consumeFrames(buffer, callbacks, true);
    } finally {
      reader.releaseLock();
    }
  }

  function consumeFrames(
    buffer: string,
    callbacks: ChatStreamCallbacks,
    flush = false
  ): string {
    const parts = buffer.split(/\r?\n\r?\n/);
    const rest = flush ? '' : parts.pop() ?? '';
    const frames = flush ? parts.filter((part) => part.trim().length > 0) : parts;

    frames.forEach((rawFrame) => {
      const frame = parseSseFrame(rawFrame);

      if (frame) {
        dispatchFrame(frame, callbacks);
      }
    });

    if (flush && rest.trim()) {
      const frame = parseSseFrame(rest);

      if (frame) {
        dispatchFrame(frame, callbacks);
      }
    }

    return rest;
  }

  function dispatchFrame(frame: SseFrame, callbacks: ChatStreamCallbacks): void {
    if (frame.event === 'delta') {
      const data = parseFrameData<ChatStreamDeltaEvent>(frame);
      callbacks.onDelta?.(data);
      callbacks.onEvent?.({
        event: 'delta',
        data
      });
      return;
    }

    if (frame.event === 'done') {
      const data = parseFrameData<ChatStreamDoneEvent>(frame);
      callbacks.onDone?.(data);
      callbacks.onEvent?.({
        event: 'done',
        data
      });
      return;
    }

    if (frame.event === 'error') {
      const data = parseFrameData<ChatStreamErrorEvent>(frame);
      error.value = data;
      status.value = 'error';
      callbacks.onError?.(data);
      callbacks.onEvent?.({
        event: 'error',
        data
      });
    }
  }

  return {
    status: readonly(status),
    error: readonly(error),
    isStreaming,
    startStream,
    abort
  };
}

export function parseSseFrame(rawFrame: string): SseFrame | null {
  const lines = rawFrame.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join('\n')
  };
}

function parseFrameData<T>(frame: SseFrame): T {
  try {
    return JSON.parse(frame.data) as T;
  } catch {
    throw new Error(`Invalid chat stream ${frame.event} payload.`);
  }
}

function toStreamError(error: unknown): ChatStreamErrorEvent {
  if (isAbortError(error)) {
    return CLIENT_ABORT_ERROR;
  }

  if (error instanceof ChatStreamHttpError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  return {
    code: 'CHAT_STREAM_CLIENT_ERROR',
    message: error instanceof Error && error.message ? error.message : 'Chat stream failed.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
