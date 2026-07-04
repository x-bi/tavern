/** 应用级备份文件格式版本标识，当前为 `tavern-lite.backup.v1`。 */
export const APPLICATION_BACKUP_FORMAT_VERSION = 'tavern-lite.backup.v1';

/** 备份文件中一条 JSON 记录的宽泛类型（逐字段语义由具体类型约束）。 */
export type BackupJsonRecord = Record<string, unknown>;

/**
 * 备份中 API Key 的安全策略：始终脱敏，不写入任何密钥内容。
 */
export type BackupApiKeyPolicy = {
  /** 策略模式，固定为脱敏。 */
  mode: 'redacted';
  /** 是否包含 Key 明文，固定为 false。 */
  included: false;
  /** 策略说明。 */
  description: string;
};

/**
 * 备份中应用设置的敏感字段策略：按正则识别敏感键并置空。
 */
export type BackupSettingsPolicy = {
  /** 识别敏感键的正则字符串。 */
  sensitiveKeyPattern: string;
  /** 敏感字段写入备份时的值，固定为 null。 */
  redactedValue: null;
  /** 策略说明。 */
  description: string;
};

/**
 * 备份的整体安全策略，记录 API Key、设置、上传文件三类资源的处理方式。
 */
export type ApplicationBackupSecurity = {
  /** API Key 处理策略。 */
  apiKeys: BackupApiKeyPolicy;
  /** 应用设置处理策略。 */
  settings: BackupSettingsPolicy;
  /** 上传文件处理策略：不包含二进制内容。 */
  uploads: {
    /** 是否包含二进制文件，固定为 false。 */
    binariesIncluded: false;
    /** 策略说明。 */
    description: string;
  };
  /** 导出时排除的数据库表名列表。 */
  excludedTables: string[];
};

/**
 * 备份中模型配置记录的形态：在通用记录基础上显式标注 API Key 已脱敏。
 */
export type ApplicationBackupModelConfig = BackupJsonRecord & {
  /** 密文 Key，固定为 null（备份不含密钥）。 */
  apiKeyCiphertext: null;
  /** 是否包含 Key，固定为 false。 */
  apiKeyIncluded: false;
  /** API Key 掩码字符串；未配置 Key 时为 null。 */
  apiKeyMask: string | null;
  /** 是否已配置过 API Key。 */
  hasApiKey: boolean;
};

/**
 * 备份中应用设置记录的形态：在通用记录基础上标注是否被脱敏。
 */
export type ApplicationBackupSetting = BackupJsonRecord & {
  /** 设置值；敏感设置被脱敏后为 null。 */
  value: string | null;
  /** 是否被脱敏。 */
  redacted: boolean;
  /** 脱敏原因；未脱敏时为 null。 */
  redactionReason: string | null;
};

/**
 * 完整的应用级逻辑备份导出结构。
 *
 * 采用逻辑 JSON 导出（logical-json），即逐表导出业务记录而非原始 SQLite 文件，
 * API Key 永不写入，敏感设置脱敏，上传文件不包含二进制。
 */
export type ApplicationBackupExport = {
  /** 备份格式版本标识。 */
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  /** 导出时间（ISO 字符串）。 */
  exportedAt: string;
  /** 应用标识信息。 */
  app: {
    /** 应用名，固定为 Tavern Lite。 */
    name: 'Tavern Lite';
    /** 备份类型，固定为 logical-json。 */
    backupKind: 'logical-json';
  };
  /** 备份范围（用户维度的元信息）。 */
  scope: {
    /** 用户 ID。 */
    userId: string;
    /** 用户名。 */
    username: string;
    /** 展示名。 */
    displayName: string;
  };
  /** 备份策略说明。 */
  strategy: {
    /** 策略类型，固定为 logical-json。 */
    type: 'logical-json';
    /** 策略描述。 */
    description: string;
  };
  /** 安全策略。 */
  security: ApplicationBackupSecurity;
  /** 各资源导出数量统计。 */
  summary: {
    /** 角色数。 */
    characters: number;
    /** 会话数。 */
    conversations: number;
    /** 消息数。 */
    messages: number;
    /** 世界书数。 */
    worldBooks: number;
    /** 世界书条目数。 */
    worldBookEntries: number;
    /** 模型配置数。 */
    modelConfigs: number;
    /** Prompt 预设数。 */
    promptPresets: number;
    /** Persona 数。 */
    personas: number;
    /** 应用设置数。 */
    appSettings: number;
    /** 资源（上传文件记录）数。 */
    assets: number;
  };
  /** 各表导出的业务数据记录。 */
  data: {
    /** 角色记录。 */
    characters: BackupJsonRecord[];
    /** 会话记录。 */
    conversations: BackupJsonRecord[];
    /** 消息记录。 */
    messages: BackupJsonRecord[];
    /** 世界书记录。 */
    worldBooks: BackupJsonRecord[];
    /** 模型配置记录（Key 已脱敏）。 */
    modelConfigs: ApplicationBackupModelConfig[];
    /** Prompt 预设记录。 */
    promptPresets: BackupJsonRecord[];
    /** Persona 记录。 */
    personas: BackupJsonRecord[];
    /** 应用设置记录（敏感项脱敏）。 */
    appSettings: ApplicationBackupSetting[];
  };
  /** 资源（上传文件元信息）记录。 */
  resources: {
    /** 资源记录。 */
    assets: BackupJsonRecord[];
    /** 说明（仅含元信息，不含二进制内容）。 */
    note: string;
  };
};

/**
 * 备份导入的入参。
 *
 * 导入为整库覆盖写，调用方需显式确认 `confirmOverwrite=true` 才会执行。
 */
export type ApplicationBackupImportPayload = {
  /** 备份文件的原始 JSON 字符串。 */
  rawJson: string;
  /** 是否确认覆盖写库；false 时后端应拒绝执行。 */
  confirmOverwrite: boolean;
};

/** 备份导入后的数量统计摘要。 */
export type ApplicationBackupImportSummary = {
  /** 导入的角色数。 */
  characters: number;
  /** 导入的会话数。 */
  conversations: number;
  /** 导入的消息数。 */
  messages: number;
  /** 导入的世界书数。 */
  worldBooks: number;
  /** 导入的世界书条目数。 */
  worldBookEntries: number;
  /** 导入的模型配置数。 */
  modelConfigs: number;
  /** 导入的 Prompt 预设数。 */
  promptPresets: number;
  /** 导入的 Persona 数。 */
  personas: number;
  /** 导入的应用设置数。 */
  appSettings: number;
  /** 导入的资源数。 */
  assets: number;
  /** 因脱敏而跳过（未恢复）的敏感设置条数。 */
  skippedRedactedSettings: number;
  /** 因脱敏而丢弃的 API Key 条数。 */
  apiKeysDropped: number;
};

/**
 * 备份导入的响应体。
 *
 * 导入策略固定为整库覆盖写，返回实际写入的统计与告警。
 */
export type ApplicationBackupImportResponse = {
  /** 固定为 true，表示导入成功。 */
  imported: true;
  /** 导入策略，固定为 full-overwrite。 */
  strategy: 'full-overwrite';
  /** 备份格式版本标识。 */
  formatVersion: typeof APPLICATION_BACKUP_FORMAT_VERSION;
  /** 导入完成时间（ISO 字符串）。 */
  importedAt: string;
  /** 源备份的导出时间（ISO 字符串）。 */
  sourceExportedAt: string;
  /** 导入数量统计摘要。 */
  summary: ApplicationBackupImportSummary;
  /** 导入过程中的告警信息列表。 */
  warnings: string[];
};
