import { BadRequestException } from '@nestjs/common';
import type { ConversationImageGenerationConfig } from '../image-generations/image-generation.types';

const IMAGE_STYLE_PRESETS = [
  'auto',
  'anime',
  'realistic',
  'cinematic',
  'illustration',
  'fantasy'
] as const;
const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
const DEFAULT_CONVERSATION_IMAGE_GENERATION_CONFIG: ConversationImageGenerationConfig = {
  stylePreset: 'auto',
  imageCount: 1,
  aspectRatio: '1:1'
};

export function parseConversationImageGenerationConfig(
  value: string | null | undefined
): ConversationImageGenerationConfig {
  if (!value) return { ...DEFAULT_CONVERSATION_IMAGE_GENERATION_CONFIG };
  try {
    return validateConversationImageGenerationConfig(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    return { ...DEFAULT_CONVERSATION_IMAGE_GENERATION_CONFIG };
  }
}

export function validateConversationImageGenerationConfig(
  value: unknown
): ConversationImageGenerationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({
      code: 'IMAGE_GENERATION_CONFIG_INVALID',
      message: 'Image generation config must be an object.'
    });
  }
  const config = value as Record<string, unknown>;
  if (
    !IMAGE_STYLE_PRESETS.includes(config.stylePreset as (typeof IMAGE_STYLE_PRESETS)[number]) ||
    !IMAGE_ASPECT_RATIOS.includes(config.aspectRatio as (typeof IMAGE_ASPECT_RATIOS)[number]) ||
    !Number.isInteger(config.imageCount) ||
    Number(config.imageCount) < 1 ||
    Number(config.imageCount) > 4
  ) {
    throw new BadRequestException({
      code: 'IMAGE_GENERATION_CONFIG_INVALID',
      message: 'Image generation style, count, or aspect ratio is invalid.'
    });
  }
  return {
    stylePreset: config.stylePreset as ConversationImageGenerationConfig['stylePreset'],
    imageCount: config.imageCount as ConversationImageGenerationConfig['imageCount'],
    aspectRatio: config.aspectRatio as ConversationImageGenerationConfig['aspectRatio']
  };
}
