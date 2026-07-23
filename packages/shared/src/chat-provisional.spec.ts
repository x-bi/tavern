import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientOperationId, createGenerationRequestId } from './chat-provisional';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('client operation IDs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when the browser exposes it', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createClientOperationId()).toBe('00000000-0000-4000-8000-000000000001');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a UUID v4 when HTTP context does not expose crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      }
    });

    expect(createGenerationRequestId()).toBe('abababab-abab-4bab-abab-abababababab');
    expect(createGenerationRequestId()).toMatch(UUID_V4_PATTERN);
  });
});
