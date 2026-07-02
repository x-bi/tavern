export const APPLICATION_BACKUP_FORMAT_VERSION = 'tavern-lite.backup.v1';

export type BackupJsonRecord = Record<string, unknown>;

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
  security: {
    apiKeys: {
      mode: 'redacted';
      included: false;
      description: string;
    };
    settings: {
      sensitiveKeyPattern: string;
      redactedValue: null;
      description: string;
    };
    uploads: {
      binariesIncluded: false;
      description: string;
    };
    excludedTables: string[];
  };
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

export type BackupExportFile = {
  filename: string;
  contentType: 'application/json; charset=utf-8';
  body: string;
};

export type BackupImportSummary = {
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

export type BackupImportResponse = {
  imported: true;
  strategy: 'full-overwrite';
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  importedAt: string;
  sourceExportedAt: string;
  summary: BackupImportSummary;
  warnings: string[];
};

export type BackupExportHttpResponse = {
  setHeader(name: string, value: string | number): void;
  status(statusCode: number): BackupExportHttpResponse;
  send(body: string): void;
};
