import { createProvisionalAssistant, reduceProvisionalAssistant } from '@tavern/shared';
import { describe, expect, it } from 'vitest';

describe('main web provisional assistant', () => {
  it('commits only on done and discards text on conflict', () => {
    const start = createProvisionalAssistant('request-1');
    const delta = reduceProvisionalAssistant(start, {
      event: 'delta',
      data: { messageId: 'm1', text: '临时文本' }
    });
    expect(delta.status).toBe('streaming');
    expect(
      reduceProvisionalAssistant(delta, { event: 'done', data: { messageId: 'm1' } }).status
    ).toBe('committed');
    expect(
      reduceProvisionalAssistant(delta, {
        event: 'error',
        data: { code: 'CONTEXT_COMMIT_CONFLICT' }
      })
    ).toMatchObject({ status: 'discarded', content: '', messageId: null });
  });
});
