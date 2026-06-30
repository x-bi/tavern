import type { PageResult } from './pagination';

export type ConversationStatus = 'active' | 'archived';

export type ConversationCharacterSummary = {
  id: string;
  name: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
};

export type ConversationPersonaSummary = {
  id: string;
  name: string;
};

export type ConversationModelConfigSummary = {
  id: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
};

export type ConversationPromptPresetSummary = {
  id: string;
  name: string;
};

export type ConversationResponse = {
  id: string;
  userId: string;
  characterId: string;
  modelConfigId: string | null;
  promptPresetId: string | null;
  personaId: string | null;
  title: string;
  status: ConversationStatus | string;
  metadata: Record<string, unknown> | null;
  lastMessageAt: string | null;
  character: ConversationCharacterSummary;
  persona: ConversationPersonaSummary | null;
  modelConfig: ConversationModelConfigSummary | null;
  promptPreset: ConversationPromptPresetSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationListResponse = PageResult<ConversationResponse>;

export type ConversationPayload = {
  title: string;
  characterId: string;
  modelConfigId?: string | null;
  promptPresetId?: string | null;
  personaId?: string | null;
  status?: ConversationStatus;
  metadata?: Record<string, unknown> | null;
};

export type ConversationUpdatePayload = Partial<ConversationPayload>;

export type ConversationClearResponse = {
  cleared: true;
  id: string;
  deletedMessages: number;
};
