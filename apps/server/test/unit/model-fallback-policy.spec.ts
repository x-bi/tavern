import { describe, expect, it } from 'vitest';
import { shouldTryNextModelCandidate } from '../../src/services/context-engine/model-fallback-policy';

describe('model fallback boundary', () => {
  it('allows fallback only before the first visible delta', () => {
    expect(
      shouldTryNextModelCandidate({
        emittedDelta: false,
        accumulatedContent: '',
        hasNextCandidate: true,
        aborted: false
      })
    ).toBe(true);
    expect(
      shouldTryNextModelCandidate({
        emittedDelta: true,
        accumulatedContent: 'partial',
        hasNextCandidate: true,
        aborted: false
      })
    ).toBe(false);
    expect(
      shouldTryNextModelCandidate({
        emittedDelta: false,
        accumulatedContent: '',
        hasNextCandidate: true,
        aborted: true
      })
    ).toBe(false);
  });
});
