import type { PageResult } from './pagination';

export const IMAGE_STYLE_PRESETS = [
  'auto',
  'anime',
  'realistic',
  'cinematic',
  'illustration',
  'fantasy'
] as const;
export type ImageStylePreset = (typeof IMAGE_STYLE_PRESETS)[number];

export const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
export type ImageCount = 1 | 2 | 3 | 4;

export type ConversationImageGenerationConfig = {
  stylePreset: ImageStylePreset;
  imageCount: ImageCount;
  aspectRatio: ImageAspectRatio;
};

export const DEFAULT_CONVERSATION_IMAGE_GENERATION_CONFIG: ConversationImageGenerationConfig = {
  stylePreset: 'auto',
  imageCount: 1,
  aspectRatio: '1:1'
};

export type SceneImageSnapshot = {
  source: {
    conversationId: string;
    assistantMessageId: string;
    requestUserMessageId?: string;
    generationTraceId?: string;
    sourceMessageContentHash: string;
  };
  scene: {
    location?: string;
    time?: string;
    weather?: string;
    environment: string[];
  };
  characters: Array<{
    name: string;
    role: 'character' | 'user' | 'other';
    appearance: string[];
    clothing: string[];
    expression?: string;
    pose?: string;
    action?: string;
    position?: string;
  }>;
  objects: Array<{ name: string; state?: string; position?: string }>;
  composition: {
    subject?: string;
    viewpoint?: 'first_person' | 'third_person';
    shotType?: string;
    cameraAngle?: string;
    focus?: string;
  };
  atmosphere: { mood?: string; lighting?: string; colorTone?: string };
  style: { preset: ImageStylePreset; promptFragment: string };
  evidence: {
    assistantMessage: string;
    requestUserMessage?: string;
    recentMessages: Array<{
      id: string;
      role: string;
      contentHash: string;
      excerpt?: string;
    }>;
    characterSource?: string;
    personaSource?: string;
    worldBookRevisionIds: string[];
  };
};

export type ScenePromptModelOutput = {
  visualScene: Pick<
    SceneImageSnapshot,
    'scene' | 'characters' | 'objects' | 'composition' | 'atmosphere'
  >;
  positivePromptBody: string;
  negativePrompt?: string;
};

export type SceneImage = {
  imageAssetId: string;
  batchId: string;
  orderIndex: number;
  fileUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type ConversationMessageImagesResponse = Array<{
  messageId: string;
  images: SceneImage[];
}>;

export type ImageGenerationBatchStatus =
  | 'pending'
  | 'building_prompt'
  | 'generating'
  | 'saving'
  | 'cancel_requested'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';

export type ImageGenerationBatchResponse = {
  id: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  parentBatchId: string | null;
  status: ImageGenerationBatchStatus;
  stylePreset: ImageStylePreset;
  requestedImageCount: number;
  aspectRatio: ImageAspectRatio;
  errorCode: string | null;
  errorMessage: string | null;
  canCancel: boolean;
  images: SceneImage[];
  createdAt: string;
  updatedAt: string;
};

export type CreateImageGenerationPayload = { requestId: string };

export type ImageListItem = {
  id: string;
  batchId: string;
  fileUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeBytes: number;
  status: string;
  stylePreset: ImageStylePreset;
  aspectRatio: ImageAspectRatio;
  modelName: string | null;
  sourceMessageSummary: string | null;
  isDisplayedInChat: boolean;
  createdAt: string;
};

export type ImageListResponse = PageResult<ImageListItem>;

export type AdminImageListItem = ImageListItem & {
  userId: string;
  username: string;
};

export type AdminImageListResponse = PageResult<AdminImageListItem>;

export type ImageDetailResponse = ImageListItem & {
  conversationId: string | null;
  sourceMessageId: string | null;
  modelFallbackGroupId: string;
  providerModelId: string | null;
  scenePromptModelId: string | null;
  prompt: string | null;
  negativePrompt: string | null;
  parameters: Record<string, unknown> | null;
  providerMetadata: Record<string, unknown> | null;
  sceneSnapshot: SceneImageSnapshot | null;
  sourceMessageContentHash: string;
  scenePromptVersion: string;
  promptCompilerVersion: string;
  invalidationReason: string | null;
};

export type AdminImageDetailResponse = ImageListItem & {
  userId: string;
  username: string;
  batchId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  modelFallbackGroupId: string;
  providerModelId: string | null;
  scenePromptModelId: string | null;
  promptHash: string | null;
  promptLength: number;
  sceneSnapshotHash: string | null;
  scenePromptInputHash: string | null;
  scenePromptOutputHash: string | null;
  sourceMessageContentHash: string;
  scenePromptVersion: string;
  promptCompilerVersion: string;
  errorCode: string | null;
  errorMessage: string | null;
};
