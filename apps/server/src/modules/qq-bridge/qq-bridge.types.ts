import type { ChatResponseLike } from '../chat/chat.types';

export type NapcatAccountConfig = {
  apiBaseUrl: string;
  accessTokenCiphertext: string | null;
};

export type OneBotPrivateMessageEvent = {
  time?: number;
  post_type: 'message' | 'message_sent';
  message_type: 'private';
  sub_type?: string;
  self_id: string | number;
  message_id: string | number;
  user_id: string | number;
  message?: unknown;
  raw_message?: string;
  sender?: { nickname?: string; card?: string };
};

/** 复用现有 SSE 生成入口，但不把中间 delta 暴露给 QQ webhook 请求。 */
export class InternalChatResponse implements ChatResponseLike {
  writableEnded = false;
  destroyed = false;
  errorCode: string | null = null;
  private buffer = '';
  private readonly closeListeners = new Set<() => void>();

  status(): ChatResponseLike {
    return this;
  }
  setHeader(): void {}
  flushHeaders(): void {}
  write(chunk: string): void {
    this.buffer += chunk;
    const frames = this.buffer.split('\n\n');
    this.buffer = frames.pop() ?? '';
    for (const frame of frames) this.consumeFrame(frame);
  }
  end(): void {
    this.writableEnded = true;
  }
  on(_event: 'close', listener: () => void): void {
    this.closeListeners.add(listener);
  }
  off(_event: 'close', listener: () => void): void {
    this.closeListeners.delete(listener);
  }

  private consumeFrame(frame: string): void {
    const event = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = frame.match(/^data:\s*(.+)$/m)?.[1];
    if (event !== 'error' || !data) return;
    try {
      const parsed = JSON.parse(data) as { code?: unknown };
      if (typeof parsed.code === 'string') this.errorCode = parsed.code;
    } catch {
      this.errorCode = 'QQ_CHAT_STREAM_ERROR_INVALID';
    }
  }
}
