/** 示例对话单条消息（用于引导模型的角色扮演风格）。 */
export type ExampleMessage = {
  /** 发言角色：user 用户方 / assistant 角色方。 */
  role: 'user' | 'assistant';
  /** 消息内容。 */
  content: string;
};

/** 角色对外响应体（不含内部 JSON 字符串，已解析为结构化数据）。 */
export type CharacterResponse = {
  id: string;
  userId: string;
  /** 头像素材 ID，未设置时为 null。 */
  avatarAssetId: string | null;
  /** 头像访问 URL，未设置头像时为 null。 */
  avatarUrl: string | null;
  name: string;
  coreIdentity: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  /** 角色的开场白。 */
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  /** 扩展元数据，可为 null。 */
  metadata: Record<string, unknown> | null;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 角色列表分页响应。 */
export type CharacterListResponse = {
  items: CharacterResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/** 导入时单个字段的处理动作。 */
export type CharacterImportFieldAction = 'mapped' | 'metadata' | 'ignored';

/** 导入字段映射记录：源字段 → 目标字段 + 处理动作。 */
export type CharacterImportFieldMapping = {
  source: string;
  target: string | null;
  action: CharacterImportFieldAction;
  note?: string;
};

/** 导入过程中的警告信息。 */
export type CharacterImportWarning = {
  code: string;
  message: string;
  field?: string;
};

/**
 * 导入预览：解析卡片后、正式落库前的中间结果。
 * 包含映射后的字段、警告、以及名称冲突检测。
 */
export type CharacterImportPreview = {
  name: string;
  coreIdentity: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: Record<string, unknown>;
  fieldMappings: CharacterImportFieldMapping[];
  warnings: CharacterImportWarning[];
  /** 是否已存在同名角色。 */
  nameConflict: boolean;
  /** 冲突时建议的副本名称，无冲突时为 null。 */
  suggestedName: string | null;
};

/** 导入接口响应：commit=false 返回预览，commit=true 返回已导入的角色。 */
export type CharacterImportResponse = {
  imported: boolean;
  preview: CharacterImportPreview;
  character: CharacterResponse | null;
};

/** 角色卡 v2 的 data 部分（遵循 chara_card_v2 规范字段名）。 */
export type CharacterExportCardData = {
  name: string;
  coreIdentity: string;
  description: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  scenario: string;
  /** 开场白（v2 规范字段名）。 */
  first_mes: string;
  /** 示例对话（v2 规范字段名，文本格式）。 */
  mes_example: string;
  creator_notes?: string;
  system_prompt?: string;
  tags?: string[];
  creator?: string;
  character_version?: string;
  alternate_greetings?: string[];
  /** 扩展字段，工具可自定义。 */
  extensions?: Record<string, unknown>;
  depth_prompt?: unknown;
  post_history_instructions?: string;
};

/** 角色卡 v2 完整结构。 */
export type CharacterExportCard = {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CharacterExportCardData;
};

/** 导出响应：文件名 + 卡片 + 导出时间 + 原始示例对话。 */
export type CharacterExportResponse = {
  fileName: string;
  card: CharacterExportCard;
  exportedAt: string;
  exampleMessages: ExampleMessage[];
};
