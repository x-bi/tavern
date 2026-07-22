/** 独立 AI 角色对外响应。 */
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
