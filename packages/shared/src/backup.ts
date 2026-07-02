export const APPLICATION_BACKUP_FORMAT_VERSION = 'tavern-lite.backup.v1';

export type BackupJsonRecord = Record<string, unknown>;

export type BackupApiKeyPolicy = {
  mode: 'redacted';
  included: false;
  description: string;
};

export type BackupSettingsPolicy = {
  sensitiveKeyPattern: string;
  redactedValue: null;
  description: string;
};

export type ApplicationBackupSecurity = {
  apiKeys: BackupApiKeyPolicy;
  settings: BackupSettingsPolicy;
  uploads: {
    binariesIncluded: false;
    description: string;
  };
  excludedTables: string[];
};

export type ApplicationBackupModelConfig = BackupJsonRecord & {
  apiKeyCiphertext: null;
  apiKeyIncluded: false;
  apiKeyMask: string | null;
  hasApiKey: boolean;
};

export type ApplicationBackupSetting = BackupJsonRecord & {
  value: string | null;
  redacted: boolean;
  redactionReason: string | null;
};

export type ApplicationBackupExport = {
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  app: {
    name: 'Tavern Lite';
    backupKind: 'logical-json';
  };
  scope: {
    userId: string;
    username: string;
    displayName: string;
  };
  strategy: {
    type: 'logical-json';
    description: string;
  };
  security: ApplicationBackupSecurity;
  summary: {
    characters: number;
    conversations: number;
    messages: number;
    worldBooks: number;
    worldBookEntries: number;
    modelConfigs: number;
    promptPresets: number;
    personas: number;
    appSettings: number;
    assets: number;
  };
  data: {
    characters: BackupJsonRecord[];
    conversations: BackupJsonRecord[];
    messages: BackupJsonRecord[];
    worldBooks: BackupJsonRecord[];
    modelConfigs: ApplicationBackupModelConfig[];
    promptPresets: BackupJsonRecord[];
    personas: BackupJsonRecord[];
    appSettings: ApplicationBackupSetting[];
  };
  resources: {
    assets: BackupJsonRecord[];
    note: string;
  };
};

export type ApplicationBackupImportPayload = {
  rawJson: string;
  confirmOverwrite: boolean;
};

export type ApplicationBackupImportSummary = {
  characters: number;
  conversations: number;
  messages: number;
  worldBooks: number;
  worldBookEntries: number;
  modelConfigs: number;
  promptPresets: number;
  personas: number;
  appSettings: number;
  assets: number;
  skippedRedactedSettings: number;
  apiKeysDropped: number;
};

export type ApplicationBackupImportResponse = {
  imported: true;
  strategy: 'full-overwrite';
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  importedAt: string;
  sourceExportedAt: string;
  summary: ApplicationBackupImportSummary;
  warnings: string[];
};
