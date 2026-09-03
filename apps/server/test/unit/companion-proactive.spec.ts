import { describe, expect, it } from 'vitest';
import {
  COMPANION_PROACTIVE_IDLE_MS,
  isCompanionProactiveHour,
  proactiveRequestId,
  shouldStartCompanionProactive
} from '../../src/modules/companion-chat/companion-proactive.service';

describe('Companion proactive scheduling policy', () => {
  const now = new Date('2026-09-03T04:00:00.000Z'); // 12:00 Asia/Shanghai

  it('allows one normal assistant reply after the idle threshold', () => {
    expect(
      shouldStartCompanionProactive(
        {
          id: 'assistant-normal',
          role: 'assistant',
          status: 'complete',
          createdAt: new Date(now.getTime() - COMPANION_PROACTIVE_IDLE_MS),
          metadataJson: null
        },
        now
      )
    ).toBe(true);
  });

  it('does not follow another proactive message or a user message', () => {
    const createdAt = new Date(now.getTime() - COMPANION_PROACTIVE_IDLE_MS * 2);
    expect(
      shouldStartCompanionProactive(
        {
          id: 'assistant-proactive',
          role: 'assistant',
          status: 'complete',
          createdAt,
          metadataJson: JSON.stringify({ origin: 'proactive' })
        },
        now
      )
    ).toBe(false);
    expect(
      shouldStartCompanionProactive(
        {
          id: 'user-latest',
          role: 'user',
          status: 'complete',
          createdAt,
          metadataJson: null
        },
        now
      )
    ).toBe(false);
  });

  it('uses the normal daytime window in Asia/Shanghai', () => {
    expect(isCompanionProactiveHour(new Date('2026-09-03T00:00:00.000Z'))).toBe(true);
    expect(isCompanionProactiveHour(new Date('2026-09-03T15:00:00.000Z'))).toBe(false);
  });

  it('keeps one idempotency key per source message and local calendar day', () => {
    expect(proactiveRequestId('assistant', new Date('2026-09-03T15:59:00.000Z'))).toBe(
      'proactive:assistant:2026-09-03'
    );
    expect(proactiveRequestId('assistant', new Date('2026-09-03T16:01:00.000Z'))).toBe(
      'proactive:assistant:2026-09-04'
    );
  });
});
