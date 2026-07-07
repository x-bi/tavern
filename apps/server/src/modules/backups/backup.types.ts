/** 备份文件格式版本标识。 */
export const APPLICATION_BACKUP_FORMAT_VERSION = 'tavern-lite.backup.v1';

/** 备份 JSON 记录（任意键值对象）。 */
export type BackupJsonRecord = Record<string, unknown>;

/** 应用设置的备份记录（敏感 key 的值脱敏为 null）。 */
export type ApplicationBackupSetting = BackupJsonRecord & {
  value: string | null;
  /** 是否因敏感 key 名被脱敏。 */
  redacted: boolean;
  redactionReason: string | null;
};

/**
 * 应用备份导出结构（逻辑 JSON 格式）。
 *
 * 安全策略：敏感设置值脱敏、上传文件二进制不嵌入。
 * 模型配置（含 API Key）不纳入备份，需在恢复后重新配置模型链。
 */
export type ApplicationBackupExport = {
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  app: {
    name: 'Tavern Lite';
    backupKind: 'logical-json';
  };
  /** 备份范围（哪个用户）。 */
  scope: {
    userId: string;
    username: string;
    displayName: string;
  };
  strategy: {
    type: 'logical-json';
    description: string;
  };
  /** 安全策略说明：敏感设置/上传文件的处理方式。 */
  security: {
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
  /** 各类数据的数量统计。 */
  summary: {
    characters: number;
    conversations: number;
    messages: number;
    worldBooks: number;
    worldBookEntries: number;
    promptPresets: number;
    personas: number;
    appSettings: number;
    assets: number;
  };
  /** 备份数据（各类记录的数组）。 */
  data: {
    characters: BackupJsonRecord[];
    conversations: BackupJsonRecord[];
    messages: BackupJsonRecord[];
    worldBooks: BackupJsonRecord[];
    promptPresets: BackupJsonRecord[];
    personas: BackupJsonRecord[];
    appSettings: ApplicationBackupSetting[];
  };
  /** 资源（素材元数据，不含二进制）。 */
  resources: {
    assets: BackupJsonRecord[];
    note: string;
  };
};

/** 导出的备份文件（文件名 + content-type + JSON 文本）。 */
export type BackupExportFile = {
  filename: string;
  contentType: 'application/json; charset=utf-8';
  body: string;
};

/** 导入结果统计。 */
export type BackupImportSummary = {
  characters: number;
  conversations: number;
  messages: number;
  worldBooks: number;
  worldBookEntries: number;
  promptPresets: number;
  personas: number;
  appSettings: number;
  assets: number;
  /** 被脱敏而未恢复的设置项数。 */
  skippedRedactedSettings: number;
};

/** 导入响应。 */
export type BackupImportResponse = {
  imported: true;
  strategy: 'full-overwrite';
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  importedAt: string;
  sourceExportedAt: string;
  summary: BackupImportSummary;
  warnings: string[];
};

/** 导出接口用的响应对象形状（setHeader/status/send）。 */
export type BackupExportHttpResponse = {
  setHeader(name: string, value: string | number): void;
  status(statusCode: number): BackupExportHttpResponse;
  send(body: string): void;
};
