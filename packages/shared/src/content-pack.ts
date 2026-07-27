import type { MessageRole } from './message';
import type {
  PromptPresetGenerationPurpose,
  PromptPresetOutputRuleOperation
} from './prompt-preset';
import type { WorldBookPlacement } from './world-book';

/** 内容包格式版本标识，供 AI 生成设定包和 Tavern Lite 增量导入使用。 */
export const CONTENT_PACK_FORMAT_VERSION = 'tavern-lite.content-pack.v2';

/** 内容包导入时遇到同名资源的处理策略。 */
export type ContentPackDuplicateStrategy = 'reject' | 'rename' | 'skip';

/** 内容包内可作为开局历史的消息角色。 */
export type ContentPackMessageRole = Extract<MessageRole, 'system' | 'user' | 'assistant'>;

/** 内容包内一条示例或开局消息。 */
export type ContentPackMessage = {
  /** 消息角色。 */
  role: ContentPackMessageRole;
  /** 消息正文。 */
  content: string;
};

/** 内容包角色定义。 */
export type ContentPackCharacter = {
  /** 包内引用名，用于 worldBooks/starterConversations 关联，不会直接落库。 */
  ref: string;
  /** 角色名。 */
  name: string;
  coreIdentity?: string;
  /** 性格设定。 */
  personality?: string;
  persistentPremise?: string;
  initialScenario?: string;
  extendedBackground?: string;
  characterRules?: string;
  speechStyle?: string;
  /** 首条消息。 */
  firstMessage?: string;
  /** 示例对话。 */
  exampleMessages?: ContentPackMessage[];
  /** 扩展元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 内容包 Persona 定义。 */
export type ContentPackPersona = {
  /** 包内引用名，用于 starterConversations 关联。 */
  ref: string;
  /** Persona 名称。 */
  name: string;
  coreIdentity?: string;
  background?: string;
  interactionPreferences?: string;
  /** 扩展元数据。 */
  metadata?: Record<string, unknown> | null;
  /** 是否设为默认。 */
  isDefault?: boolean;
};

/** 内容包 Prompt 预设定义。 */
export type ContentPackPromptPreset = {
  /** 包内引用名，用于 starterConversations 关联。 */
  ref: string;
  /** 预设名称。 */
  name: string;
  /** 预设说明。 */
  description?: string;
  instructions?: string[];
  outputRuleOperations?: PromptPresetOutputRuleOperation[];
  generationPurposes?: PromptPresetGenerationPurpose[];
  /** 模型参数。 */
  parameters?: Record<string, unknown> | null;
  /** 扩展元数据。 */
  metadata?: Record<string, unknown> | null;
  /** 是否设为默认。 */
  isDefault?: boolean;
};

/** 内容包世界书条目定义。 */
export type ContentPackWorldBookEntry = {
  /** 条目标题。 */
  title: string;
  /** 条目正文。 */
  content: string;
  /** 主关键词列表，至少一个。 */
  keywords: string[];
  /** 次关键词列表。 */
  secondaryKeywords?: string[];
  /** 是否启用。 */
  isEnabled?: boolean;
  primaryLogic?: 'any' | 'all';
  secondaryLogic?: 'and_any' | 'and_all' | 'not_any' | 'not_all';
  excludeKeywords?: string[];
  sameMessageOnly?: boolean;
  scanSources?: Array<'current_user' | 'user_history' | 'assistant_latest'>;
  userHistoryScanDepth?: number;
  cooldownPolicy?: 'strict' | 'current_user_override';
  budgetPriority?: number;
  sortOrder?: number;
  compactContent?: string;
  /** V2 注入位置。 */
  placement?: WorldBookPlacement;
  /** 条目独立最大 token。 */
  maxTokens?: number | null;
  contentType?: 'lore' | 'state' | 'behavior_rule' | 'reference';
  activationMode?: 'constant' | 'keyword' | 'manual';
  matchMode?: 'contains' | 'normalized_phrase';
  stickyTurns?: number;
  continuationTurns?: number;
  cooldownTurns?: number;
  delayTurns?: number;
  generationPurposes?: string[];
};

/** 内容包世界书定义。 */
export type ContentPackWorldBook = {
  /** 包内引用名，用于调试和后续扩展。 */
  ref: string;
  /** 关联角色的包内引用；为空表示共享世界书。 */
  characterRef?: string | null;
  /** 世界书名称。 */
  name: string;
  /** 世界书说明。 */
  description?: string;
  /** 是否启用。 */
  isEnabled?: boolean;
  /** 扫描深度。 */
  scanDepth?: number;
  /** 整本世界书 token 预算。 */
  tokenBudget?: number;
  /** 扩展元数据。 */
  metadata?: Record<string, unknown> | null;
  /** 世界书条目列表。 */
  entries?: ContentPackWorldBookEntry[];
};

/** 内容包开局会话定义。 */
export type ContentPackStarterConversation = {
  /** 包内引用名。 */
  ref: string;
  /** 会话标题。 */
  title: string;
  /** 关联角色的包内引用。 */
  characterRef: string;
  /** 关联 Persona 的包内引用。 */
  personaRef?: string | null;
  /** 关联 Prompt 预设的包内引用。 */
  promptPresetRef?: string | null;
  /** 扩展元数据。 */
  metadata?: Record<string, unknown> | null;
  /** 初始消息。 */
  messages?: ContentPackMessage[];
};

/** AI 生成内容包的顶层结构。 */
export type ContentPackDocument = {
  /** 格式版本，固定为 tavern-lite.content-pack.v2。 */
  format: typeof CONTENT_PACK_FORMAT_VERSION;
  /** 内容包标题。 */
  title: string;
  /** 内容包说明。 */
  description?: string;
  /** 风格或类型标签。 */
  genre?: string;
  /** 叙事语气。 */
  tone?: string;
  /** 角色列表。 */
  characters?: ContentPackCharacter[];
  /** Persona 列表。 */
  personas?: ContentPackPersona[];
  /** Prompt 预设列表。 */
  promptPresets?: ContentPackPromptPreset[];
  /** 世界书列表。 */
  worldBooks?: ContentPackWorldBook[];
  /** 开局会话列表。 */
  starterConversations?: ContentPackStarterConversation[];
};

/** 内容包导入入参。 */
export type ContentPackImportPayload = {
  /** 内容包原始 JSON 字符串。 */
  rawJson: string;
  /** 是否真正落库；默认 false 只做预览。 */
  commit?: boolean;
  /** 同名冲突处理策略，默认 reject。 */
  duplicateStrategy?: ContentPackDuplicateStrategy;
};

/** 内容包导入告警。 */
export type ContentPackImportWarning = {
  /** 告警码。 */
  code: string;
  /** 给人看的告警说明。 */
  message: string;
  /** 相关字段路径。 */
  path?: string;
};

/** 内容包导入冲突项。 */
export type ContentPackImportConflict = {
  /** 冲突资源类型。 */
  type: 'character' | 'persona' | 'promptPreset' | 'worldBook';
  /** 原始名称。 */
  name: string;
  /** 冲突处理动作。 */
  action: ContentPackDuplicateStrategy;
  /** 自动重命名后的建议名。 */
  suggestedName?: string;
};

/** 内容包导入数量统计。 */
export type ContentPackImportSummary = {
  /** 角色数。 */
  characters: number;
  /** Persona 数。 */
  personas: number;
  /** Prompt 预设数。 */
  promptPresets: number;
  /** 世界书数。 */
  worldBooks: number;
  /** 世界书条目数。 */
  worldBookEntries: number;
  /** 开局会话数。 */
  conversations: number;
  /** 初始消息数。 */
  messages: number;
  /** 因 skip 策略跳过的资源数。 */
  skipped: number;
};

/** 内容包导入预览。 */
export type ContentPackImportPreview = {
  /** 内容包标题。 */
  title: string;
  /** 内容包说明。 */
  description: string;
  /** 导入数量统计。 */
  summary: ContentPackImportSummary;
  /** 冲突项列表。 */
  conflicts: ContentPackImportConflict[];
  /** 告警项列表。 */
  warnings: ContentPackImportWarning[];
};

/** 内容包正式导入后的 ID 映射结果。 */
export type ContentPackImportResult = {
  /** 新建角色 ID。 */
  characterIds: string[];
  /** 新建 Persona ID。 */
  personaIds: string[];
  /** 新建 Prompt 预设 ID。 */
  promptPresetIds: string[];
  /** 新建世界书 ID。 */
  worldBookIds: string[];
  /** 新建会话 ID。 */
  conversationIds: string[];
};

/** 内容包导入响应。 */
export type ContentPackImportResponse = {
  /** 是否已真正落库。 */
  imported: boolean;
  /** 导入预览。 */
  preview: ContentPackImportPreview;
  /** 正式导入后的结果；预览时为 null。 */
  result: ContentPackImportResult | null;
};
