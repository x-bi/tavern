import { describe, expect, it } from 'vitest';
import { TargetEventsService } from '../../src/services/target-events/target-events.service';
import { InternalChatResponse } from '../../src/modules/qq-bridge/qq-bridge.types';
import {
  extractOneBotText,
  isPrivateFriendMessage,
  splitQqText
} from '../../src/modules/qq-bridge/qq-message.utils';

describe('QQ bridge message contract', () => {
  it('accepts only inbound private messages and extracts text segments', () => {
    const event = {
      post_type: 'message' as const,
      message_type: 'private' as const,
      sub_type: 'friend',
      self_id: 10001,
      user_id: 20002,
      message_id: 30003,
      message: [
        { type: 'text', data: { text: '你好' } },
        { type: 'image', data: { file: 'ignored.jpg' } },
        { type: 'text', data: { text: '呀' } }
      ]
    };
    expect(isPrivateFriendMessage(event)).toBe(true);
    expect(extractOneBotText(event)).toBe('你好呀');
    expect(isPrivateFriendMessage({ ...event, post_type: 'message_sent' })).toBe(false);
    expect(isPrivateFriendMessage({ ...event, message_type: 'group' })).toBe(false);
    expect(isPrivateFriendMessage({ ...event, sub_type: 'group' })).toBe(false);
  });

  it('splits long replies without dropping content', () => {
    const source = `${'a'.repeat(15)}\n${'b'.repeat(16)}`;
    const chunks = splitQqText(source, 20);
    expect(chunks.every((item) => item.length <= 20)).toBe(true);
    expect(chunks.join('')).toBe(source);
  });

  it('captures an internal SSE error without closing the synthetic client', () => {
    const response = new InternalChatResponse();
    response.write('event: delta\ndata: {"text":"x"}\n\n');
    response.write('event: error\ndata: {"code":"MODEL_FAILED"}\n\n');
    expect(response.errorCode).toBe('MODEL_FAILED');
    expect(response.destroyed).toBe(false);
  });

  it('publishes target identity to infrastructure-wide subscribers', () => {
    const events = new TargetEventsService();
    const received: unknown[] = [];
    const unsubscribe = events.subscribeAll((event) => received.push(event));
    events.emit('companion', 'companion-1', 'generation_done', { messageId: 'message-1' });
    unsubscribe();
    events.emit('companion', 'companion-1', 'generation_done', { messageId: 'message-2' });
    expect(received).toEqual([
      {
        targetType: 'companion',
        targetId: 'companion-1',
        event: 'generation_done',
        data: { messageId: 'message-1' }
      }
    ]);
  });
});
