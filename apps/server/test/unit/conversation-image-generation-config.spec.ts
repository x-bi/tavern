import { describe, expect, it } from 'vitest';

import {
  parseConversationImageGenerationConfig,
  validateConversationImageGenerationConfig
} from '../../src/modules/conversations/image-generation-config';

describe('conversation image generation config', () => {
  it('uses the stable default for empty or malformed persisted JSON', () => {
    expect(parseConversationImageGenerationConfig(null)).toEqual({
      stylePreset: 'auto',
      imageCount: 1,
      aspectRatio: '1:1'
    });
    expect(parseConversationImageGenerationConfig('{')).toEqual({
      stylePreset: 'auto',
      imageCount: 1,
      aspectRatio: '1:1'
    });
  });

  it('accepts only the documented enum values and image count range', () => {
    expect(
      validateConversationImageGenerationConfig({
        stylePreset: 'cinematic',
        imageCount: 4,
        aspectRatio: '16:9'
      })
    ).toEqual({
      stylePreset: 'cinematic',
      imageCount: 4,
      aspectRatio: '16:9'
    });
    expect(() =>
      validateConversationImageGenerationConfig({
        stylePreset: 'cinematic',
        imageCount: 5,
        aspectRatio: '16:9'
      })
    ).toThrow();
  });
});
