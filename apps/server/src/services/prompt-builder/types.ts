/** Prompt 构建模式：chat 实际对话 / preview 预览调试。 */
export type PromptBuildMode = 'chat' | 'preview';

/** 供应商消息角色（发给模型的最终消息用这个角色集）。 */
export type PromptProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 内部消息角色：在 provider 角色基础上增加 developer（支持开发者角色的模型用）。 */
export type PromptInternalMessageRole = PromptProviderMessageRole | 'developer';

/** Prompt Builder 使用的统一消息角色（内部角色）。 */
export type PromptMessageRole = PromptInternalMessageRole;

/** Prompt section 种类：标识每段内容来源。 */
export type PromptSectionKind =
  | 'platform' // 平台级固定规则
  | 'character' // 角色设定
  | 'persona' // 用户人设
  | 'prompt_preset' // 预设
  | 'worldbook' // 世界书条目
  | 'history' // 历史消息
  | 'current_user_input' // 当前用户输入
  | 'output_rules'; // 输出规则

/** Prompt section 来源（用于追溯每段内容来自哪个数据源）。 */
export type PromptSectionSource =
  | 'system'
  | 'character'
  | 'persona'
  | 'prompt_preset'
  | 'worldbook'
  | 'message'
  | 'runtime';

/** 世界书条目插入位置（决定 section 在最终消息序列中的插入点）。 */
export type WorldBookEntryPosition =
  | 'before_history' // 历史消息前
  | 'after_history' // 历史消息后
  | 'before_current_user_input' // 当前用户输入前
  | 'after_current_user_input'; // 当前用户输入后

/** 通用消息形态（数据库消息、示例对话等都转成这个形态供 builder 使用）。 */
export type ChatMessageLike = {
  id: string;
  conversationId: string;
  role: PromptMessageRole | string;
  content: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  tokenCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

/** 发给模型的最终消息（OpenAI compatible 格式）。 */
export type ProviderChatMessage = {
  role: PromptProviderMessageRole | 'developer';
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown> | null;
};

/** 单个 Prompt section（构建过程中的一段内容）。 */
export type PromptSection = {
  id: string;
  kind: PromptSectionKind;
  source: PromptSectionSource;
  title: string;
  content: string;
  /** 是否纳入最终消息（false 表示被裁剪/跳过，但仍记录用于调试）。 */
  isIncluded: boolean;
  /** 排序序号（决定在消息序列中的位置）。 */
  order: number;
  tokenEstimate?: number | null;
  sourceId?: string | null;
  /** 跳过/裁剪原因。 */
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** 逻辑消息（一组同属一条消息的 section 聚合，转成最终消息前的中间形态）。 */
export type PromptBuilderMessage = {
  role: PromptInternalMessageRole;
  content: string;
  sectionIds: string[];
  tokenEstimate?: number | null;
  metadata?: Record<string, unknown> | null;
};

/** 会话上下文。 */
export type PromptConversationContext = {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

/** 角色上下文（含示例对话）。 */
export type PromptCharacterContext = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages?: ChatMessageLike[];
  metadata?: Record<string, unknown> | null;
};

/** 用户人设上下文。 */
export type PromptPersonaContext = {
  id: string;
  name: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

/** 预设上下文。 */
export type PromptPresetContext = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  outputRules: string;
  parameters?: PromptModelParameters | null;
  metadata?: Record<string, unknown> | null;
};

/** 模型调用参数。 */
export type PromptModelParameters = {
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
};

/** 模型配置上下文。 */
export type PromptModelConfigContext = {
  id: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  parameters?: PromptModelParameters | null;
  metadata?: Record<string, unknown> | null;
};

/** 世界书条目上下文。 */
export type WorldBookEntryContext = {
  id: string;
  worldBookId: string;
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords?: string[];
  isEnabled: boolean;
  priority: number;
  position: WorldBookEntryPosition;
  tokenBudget?: number | null;
  caseSensitive: boolean;
  metadata?: Record<string, unknown> | null;
};

/** 世界书上下文（含其条目）。 */
export type WorldBookContext = {
  id: string;
  userId: string;
  characterId?: string | null;
  name: string;
  description: string;
  isEnabled: boolean;
  /** 扫描深度：扫描最近多少条消息触发关键词。 */
  scanDepth: number;
  /** token 预算：世界书条目总 token 上限。 */
  tokenBudget: number;
  entries: WorldBookEntryContext[];
  metadata?: Record<string, unknown> | null;
};

/** 世界书匹配命中的条目（含命中关键词、来源消息等）。 */
export type WorldBookMatchedEntry = {
  worldBookId: string;
  worldBookName: string;
  entryId: string;
  title: string;
  content: string;
  keywords: string[];
  /** 实际命中的关键词。 */
  matchedKeywords: string[];
  secondaryKeywords?: string[];
  matchedSecondaryKeywords?: string[];
  priority: number;
  position: WorldBookEntryPosition;
  insertionOrder: WorldBookEntryPosition;
  tokenBudget?: number | null;
  tokenEstimate?: number | null;
  /** 触发命中的来源消息 ID。 */
  sourceMessageIds: string[];
  metadata?: Record<string, unknown> | null;
};

/** 世界书未命中的条目（含跳过原因）。 */
export type WorldBookSkippedEntry = {
  worldBookId: string;
  entryId: string;
  title: string;
  /** 跳过原因：禁用/无关键词命中/次要关键词未命中/token 超预算。 */
  reason: 'disabled' | 'no_keyword_match' | 'secondary_keyword_miss' | 'token_budget_exceeded';
  tokenEstimate?: number | null;
};

/** 世界书匹配结果。 */
export type WorldBookMatchResult = {
  scannedMessageIds: string[];
  scanDepth: number;
  tokenBudget: number;
  usedTokenEstimate: number;
  matchedEntries: WorldBookMatchedEntry[];
  skippedEntries: WorldBookSkippedEntry[];
};

/** 被裁剪的历史消息项。 */
export type PromptTruncatedHistoryItem = {
  messageId: string;
  role: PromptMessageRole | string;
  /** 裁剪原因：超出条数限制 / 超出 token 预算。 */
  reason: 'history_limit' | 'token_budget';
  tokenEstimate?: number | null;
};

/** 构建过程中的警告。 */
export type PromptBuildWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

/** 构建调试信息（预览/调试时返回，含匹配、裁剪、最终消息等）。 */
export type BuildPromptDebugInfo = {
  matchedEntries: WorldBookMatchedEntry[];
  truncatedHistory: PromptTruncatedHistoryItem[];
  finalMessages: ProviderChatMessage[];
  sectionOrder: string[];
  warnings: PromptBuildWarning[];
};

/** 构建选项。 */
export type PromptBuildOptions = {
  mode: PromptBuildMode;
  historyLimit?: number;
  maxHistoryCharacters?: number;
  maxPromptTokens?: number;
  /** 是否包含调试信息。 */
  includeDebug?: boolean;
  /** 模型是否支持 developer 角色。 */
  supportsDeveloperRole?: boolean;
};

/** Prompt 构建输入（会话/角色/人设/预设/模型配置/历史/当前输入/世界书/选项）。 */
export type BuildPromptInput = {
  userId: string;
  conversation: PromptConversationContext;
  character: PromptCharacterContext;
  persona?: PromptPersonaContext | null;
  promptPreset?: PromptPresetContext | null;
  modelConfig?: PromptModelConfigContext | null;
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  worldBooks?: WorldBookContext[];
  options: PromptBuildOptions;
};

/** 构建结果。 */
export type BuildPromptResult = {
  conversationId: string;
  sections: PromptSection[];
  logicalMessages: PromptBuilderMessage[];
  /** 发给模型的最终消息序列。 */
  finalMessages: ProviderChatMessage[];
  worldBook: WorldBookMatchResult;
  truncatedHistory: PromptTruncatedHistoryItem[];
  tokenEstimate?: number | null;
  debug: BuildPromptDebugInfo;
};

/** 预览构建结果（带生成时间）。 */
export type PromptPreviewResult = {
  conversationId: string;
  generatedAt: string;
  result: BuildPromptResult;
};

/** 预览请求载荷。 */
export type PromptPreviewPayload = {
  conversationId: string;
  userInput: string;
  historyLimit?: number;
  maxHistoryCharacters?: number;
  supportsDeveloperRole?: boolean;
};

/** 历史裁剪信息（请求限制 vs 实际使用 vs 被裁剪）。 */
export type PromptHistoryTrimInfo = {
  requestedHistoryLimit: number;
  requestedMaxHistoryCharacters: number;
  availableHistoryCount: number;
  usedHistoryCount: number;
  truncatedCount: number;
  truncatedHistory: PromptTruncatedHistoryItem[];
};

/** 预览响应中的世界书调试信息。 */
export type PromptPreviewWorldBookDebug = {
  scanDepth: number;
  tokenBudget: number;
  usedTokenEstimate: number;
  scannedMessageIds: string[];
  matchedCount: number;
  skippedCount: number;
  matchedEntries: WorldBookMatchedEntry[];
  skippedEntries: WorldBookSkippedEntry[];
  /** 实际插入的 section 列表。 */
  insertedSections: Array<{
    sectionId: string;
    entryId: string | null;
    title: string;
    insertionOrder: WorldBookEntryPosition | null;
    order: number;
    tokenEstimate?: number | null;
  }>;
};

/** Prompt 预览接口响应。 */
export type PromptPreviewResponse = {
  conversationId: string;
  generatedAt: string;
  sections: PromptSection[];
  logicalMessages: PromptBuilderMessage[];
  finalMessages: ProviderChatMessage[];
  worldBook: WorldBookMatchResult;
  worldBookDebug: PromptPreviewWorldBookDebug;
  historyTrimInfo: PromptHistoryTrimInfo;
  tokenEstimate?: number | null;
  debug: BuildPromptDebugInfo;
};
