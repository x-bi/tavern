/** 内容包格式版本标识。 */
export const CONTENT_PACK_FORMAT_VERSION = 'tavern-lite.content-pack.v1';

/** 内容包导入时遇到同名资源的处理策略。 */
export type ContentPackDuplicateStrategy = 'reject' | 'rename' | 'skip';

/** 内容包内可作为开局历史的消息角色。 */
export type ContentPackMessageRole = 'system' | 'user' | 'assistant';

/** 内容包内一条示例或开局消息。 */
export type ContentPackMessage = {
  role: ContentPackMessageRole;
  content: string;
};

/** 内容包世界书条目注入位置。 */
export type ContentPackWorldBookEntryPosition =
  | 'before_history'
  | 'after_history'
  | 'before_current_user_input'
  | 'after_current_user_input';

/** 内容包世界书条目定义。 */
export type ContentPackWorldBookEntry = {
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords?: string[];
  isEnabled?: boolean;
  priority?: number;
  insertionOrder?: ContentPackWorldBookEntryPosition;
  tokenBudget?: number | null;
  caseSensitive?: boolean;
  metadata?: Record<string, unknown> | null;
};

/** 内容包顶层结构。 */
export type ContentPackDocument = {
  format: typeof CONTENT_PACK_FORMAT_VERSION;
  title: string;
  description?: string;
  characters?: unknown[];
  personas?: unknown[];
  promptPresets?: unknown[];
  worldBooks?: unknown[];
  starterConversations?: unknown[];
};

/** 内容包导入告警。 */
export type ContentPackImportWarning = {
  code: string;
  message: string;
  path?: string;
};

/** 内容包导入冲突项。 */
export type ContentPackImportConflict = {
  type: 'character' | 'persona' | 'promptPreset' | 'worldBook';
  name: string;
  action: ContentPackDuplicateStrategy;
  suggestedName?: string;
};

/** 内容包导入数量统计。 */
export type ContentPackImportSummary = {
  characters: number;
  personas: number;
  promptPresets: number;
  worldBooks: number;
  worldBookEntries: number;
  conversations: number;
  messages: number;
  skipped: number;
};

/** 内容包导入预览。 */
export type ContentPackImportPreview = {
  title: string;
  description: string;
  summary: ContentPackImportSummary;
  conflicts: ContentPackImportConflict[];
  warnings: ContentPackImportWarning[];
};

/** 内容包正式导入后的 ID 映射结果。 */
export type ContentPackImportResult = {
  characterIds: string[];
  personaIds: string[];
  promptPresetIds: string[];
  worldBookIds: string[];
  conversationIds: string[];
};

/** 内容包导入响应。 */
export type ContentPackImportResponse = {
  imported: boolean;
  preview: ContentPackImportPreview;
  result: ContentPackImportResult | null;
};
