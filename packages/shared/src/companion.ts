export type CompanionPayload = {
  name: string;
  identityPrompt?: string;
  avatarAssetId?: string | null;
  modelFallbackGroupId?: string | null;
  promptPresetId?: string | null;
  personaId?: string | null;
};

export type CompanionResponse = {
  id: string;
  userId: string;
  name: string;
  identityPrompt: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  modelFallbackGroupId: string | null;
  promptPresetId: string | null;
  personaId: string | null;
  memoryEnabled: boolean;
  memoryPaused: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanionListResponse = {
  items: CompanionResponse[];
  total: number;
  page: number;
  pageSize: number;
};
export type CompanionMessageStatus =
  | 'generating'
  | 'complete'
  | 'failed'
  | 'stopped'
  | 'deleted'
  | 'edited';
export type CompanionMessageResponse = {
  id: string;
  companionId: string;
  role: 'user' | 'assistant';
  content: string;
  status: CompanionMessageStatus;
  tokenCount: number | null;
  createdAt: string;
  updatedAt: string;
};
export type CompanionMemoryStatus = 'ready' | 'pending' | 'updating' | 'stale' | 'failed';
export type CompanionMemoryRevisionResponse = {
  id: string;
  companionId: string;
  version: number;
  relationshipState: string;
  currentArc: string;
  lastSummarizedMessageId: string | null;
  reason: string;
  createdAt: string;
};
export type CompanionMemoryResponse = {
  companionId: string;
  isEnabled: boolean;
  isPaused: boolean;
  memoryModelFallbackGroupId: string | null;
  status: CompanionMemoryStatus;
  relationshipState: string;
  currentArc: string;
  lastSummarizedMessageId: string | null;
  updateEveryMessages: number;
  lastErrorCode: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  revisions: CompanionMemoryRevisionResponse[];
};
export type CompanionMemoryPayload = {
  isEnabled?: boolean;
  isPaused?: boolean;
  memoryModelFallbackGroupId?: string | null;
  updateEveryMessages?: number;
  relationshipState?: string;
  currentArc?: string;
};
export type CompanionChatStreamPayload = { userMessage?: string; regenerateMessageId?: string };
export type CompanionImportPreview = {
  format: 'tavern-lite.companion.v1' | 'chara_card_v2' | 'generic-json';
  name: string;
  identityPrompt: string;
  nameConflict: boolean;
  suggestedName: string | null;
  warnings: string[];
};
export type CompanionImportResponse = {
  imported: boolean;
  preview: CompanionImportPreview;
  companion: CompanionResponse | null;
};
export type CompanionExportResponse = {
  fileName: string;
  card: {
    formatVersion: 'tavern-lite.companion.v1';
    name: string;
    identityPrompt: string;
    exportedAt: string;
  };
};
export type CompanionImportTemplateResponse = {
  fileName: string;
  template: {
    formatVersion: 'tavern-lite.companion.v1';
    name: string;
    identityPrompt: string;
  };
};
export type CompanionPromptSectionKind =
  | 'platform'
  | 'companion_identity'
  | 'persona'
  | 'prompt_preset'
  | 'output_rules'
  | 'companion_style'
  | 'companion_memory'
  | 'history'
  | 'anti_repeat'
  | 'current_user_input';
export type CompanionPromptPreviewResponse = {
  sections: Array<{
    kind: CompanionPromptSectionKind;
    content: string;
    included: boolean;
    tokenEstimate: number;
  }>;
  includedMemory: boolean;
  memorySkipReason: string | null;
  memoryVersion: number | null;
  historyTrimmed: number;
  promptBudget: number;
  historyBudget: number;
  generatedAt: string;
};
