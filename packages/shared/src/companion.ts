import type { PromptModelParameters, ProviderChatMessage } from './prompt-builder';

export type CompanionPayload = {
  name: string;
  identityPrompt?: string;
  coreIdentity?: string;
  personality?: string;
  speechStyle?: string;
  relationshipDefaults?: string;
  avatarAssetId?: string | null;
  modelFallbackGroupId?: string | null;
  promptPresetId?: string | null;
  personaId?: string | null;
  isSensitive?: boolean;
  isShared?: boolean;
};

export type CompanionResponse = {
  id: string;
  userId: string;
  name: string;
  identityPrompt: string;
  coreIdentity: string;
  personality: string;
  speechStyle: string;
  relationshipDefaults: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  modelFallbackGroupId: string | null;
  promptPresetId: string | null;
  personaId: string | null;
  memoryEnabled: boolean;
  memoryPaused: boolean;
  runtimeState: {
    currentMood: string | null;
    currentSituation: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
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
  turnId: string | null;
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
export type CompanionChatStreamPayload = {
  requestId: string;
  userMessage?: string;
  regenerateMessageId?: string;
  turnId?: string;
};
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
    coreIdentity: string;
    personality: string;
    speechStyle: string;
    relationshipDefaults: string;
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
export type CompanionPromptPreviewResponse = {
  messages: ProviderChatMessage[];
  dryRun: true;
  compilerVersion: string;
  promptSnapshotHash: string;
  compiledSections: import('./context-engine').CompiledPromptSection[];
  warnings: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
  parameters: PromptModelParameters | null;
  memoryVersion: number | null;
  promptBudget: number;
  tokenEstimate: number;
  generatedAt: string;
};
