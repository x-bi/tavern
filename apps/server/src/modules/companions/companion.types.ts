/** AI 角色独立导入/导出格式版本。 */
export const COMPANION_FORMAT_VERSION = 'tavern-lite.companion.v2';

/** 独立 AI 角色对外响应。 */
export type CompanionResponse = {
  id: string;
  userId: string;
  name: string;
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
  format: typeof COMPANION_FORMAT_VERSION;
  name: string;
  coreIdentity: string;
  personality: string;
  speechStyle: string;
  relationshipDefaults: string;
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
    formatVersion: typeof COMPANION_FORMAT_VERSION;
    name: string;
    coreIdentity: string;
    personality: string;
    speechStyle: string;
    relationshipDefaults: string;
    exportedAt: string;
  };
};
