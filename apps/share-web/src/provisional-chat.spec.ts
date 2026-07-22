import { createProvisionalAssistant, reduceProvisionalAssistant } from '@tavern/shared';
import { describe, expect, it } from 'vitest';

describe('share-web provisional assistant', () => {
  it('uses the same provisional failure semantics as the main site', () => {
    const delta = reduceProvisionalAssistant(createProvisionalAssistant('public-request'), {
      event: 'delta',
      data: { text: '不可提前落地' }
    });
    const failed = reduceProvisionalAssistant(delta, {
      event: 'error',
      data: { code: 'PROVIDER_ERROR' }
    });
    expect(failed).toEqual({
      requestId: 'public-request',
      messageId: null,
      content: '',
      status: 'discarded',
      errorCode: 'PROVIDER_ERROR'
    });
  });
});
