import { describe, expect, it } from 'vitest';
import { canonicalJson, canonicalSha256 } from '../../src/common/canonical-json';

describe('canonical JSON and hash', () => {
  it('sorts object keys while preserving array and message order', () => {
    const left = { z: 1, a: { y: true, x: null }, messages: ['user', 'assistant'] };
    const right = { messages: ['user', 'assistant'], a: { x: null, y: true }, z: 1 };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(canonicalSha256(left)).toBe(canonicalSha256(right));
    expect(canonicalSha256({ ...left, messages: ['assistant', 'user'] })).not.toBe(
      canonicalSha256(left)
    );
  });
});
