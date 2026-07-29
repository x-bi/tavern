export type ImageStylePreset =
  | 'auto'
  | 'anime'
  | 'realistic'
  | 'cinematic'
  | 'illustration'
  | 'fantasy';
export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
export type ConversationImageGenerationConfig = {
  stylePreset: ImageStylePreset;
  imageCount: 1 | 2 | 3 | 4;
  aspectRatio: ImageAspectRatio;
};

export type SceneImageSnapshot = {
  source: {
    conversationId: string;
    assistantMessageId: string;
    requestUserMessageId?: string;
    generationTraceId?: string;
    sourceMessageContentHash: string;
  };
  scene: { location?: string; time?: string; weather?: string; environment: string[] };
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

export type ImageGenerationBatchResponse = {
  id: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  parentBatchId: string | null;
  status:
    | 'pending'
    | 'building_prompt'
    | 'generating'
    | 'saving'
    | 'cancel_requested'
    | 'succeeded'
    | 'partially_succeeded'
    | 'failed'
    | 'cancelled';
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
