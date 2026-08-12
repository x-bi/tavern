import type { OneBotPrivateMessageEvent } from './qq-bridge.types';

export function isPrivateFriendMessage(value: unknown): value is OneBotPrivateMessageEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    event.post_type === 'message' &&
    event.message_type === 'private' &&
    (event.sub_type === undefined || event.sub_type === 'friend') &&
    event.message_id !== undefined &&
    event.user_id !== undefined &&
    event.self_id !== undefined
  );
}

export function extractOneBotText(event: OneBotPrivateMessageEvent): string {
  if (typeof event.message === 'string') return event.message.trim();
  if (Array.isArray(event.message)) {
    return event.message
      .map((segment) => {
        if (!segment || typeof segment !== 'object') return '';
        const item = segment as { type?: unknown; data?: { text?: unknown } };
        return item.type === 'text' && typeof item.data?.text === 'string' ? item.data.text : '';
      })
      .join('')
      .trim();
  }
  return typeof event.raw_message === 'string' ? event.raw_message.trim() : '';
}

/** QQ 单条消息保守限制为 1800 字符，优先在换行处分段。 */
export function splitQqText(value: string, limit = 1800): string[] {
  const text = value.trim();
  if (!text) return [];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    const newline = remaining.lastIndexOf('\n', limit);
    const splitAt = newline >= Math.floor(limit * 0.5) ? newline + 1 : limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
