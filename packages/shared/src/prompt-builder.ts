import type { MessageRole } from './message';

/** Prompt 构建模式：真实聊天或预览。 */
export type PromptBuildMode = 'chat' | 'preview';

/** Prompt 的实际任务用途。 */
export type PromptBuildPurpose = 'chat_reply' | 'user_suggestions';

/** 发往供应商的消息角色（不含 developer，OpenAI 兼容口径）。 */
export type PromptProviderMessageRole = Extract<
  MessageRole,
  'system' | 'user' | 'assistant' | 'tool'
>;

/** Builder 内部消息角色，在供应商口径基础上增加 developer（用于支持 developer role 的模型）。 */
export type PromptInternalMessageRole = PromptProviderMessageRole | 'developer';

/** Builder 消息统一角色别名，当前等价于内部角色集合。 */
export type PromptMessageRole = PromptInternalMessageRole;

/**
 * Prompt 组成段落的来源类别，对应可解释的拼接段落：
 * - `platform` 平台基础规则；
 * - `character` 角色卡信息；
 * - `persona` 用户 Persona；
 * - `prompt_preset` 参数预设；
 * - `worldbook` 命中的世界书条目；
 * - `history` 历史消息；
 * - `current_user_input` 当前用户输入；
 * - `output_rules` 输出格式与安全约束。
 */
export type PromptSectionKind =
  | 'platform'
  | 'character'
  | 'persona'
  | 'prompt_preset'
  | 'worldbook'
  | 'history'
  | 'current_user_input'
  | 'output_rules';

/** 段落的逻辑来源标识，用于追溯每段内容出自哪个输入源。 */
export type PromptSectionSource =
  | 'system'
  | 'character'
  | 'persona'
  | 'prompt_preset'
  | 'worldbook'
  | 'message'
  | 'runtime';

/**
 * 世界书条目注入位置，相对历史消息与当前用户输入的前后：
 * - `before_history` 历史消息之前；
 * - `after_history` 历史消息之后；
 * - `before_current_user_input` 当前用户输入之前；
 * - `after_current_user_input` 当前用户输入之后。
 */
export type WorldBookEntryPosition =
  | 'before_history'
  | 'after_history'
  | 'before_current_user_input'
  | 'after_current_user_input';

/** Builder 接受的、类消息结构的数据（不要求是完整数据库实体，便于复用）。 */
export type ChatMessageLike = {
  /** 消息 ID。 */
  id: string;
  /** 所属会话 ID。 */
  conversationId: string;
  /** 消息角色（标准 role 之外的字符串视为自定义角色）。 */
  role: PromptMessageRole | string;
  /** 消息正文。 */
  content: string;
  /** 消息状态（可选，仅用于辅助判断）。 */
  status?: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
  /** token 数估算。 */
  tokenCount?: number | null;
  /** 创建时间（ISO 字符串）。 */
  createdAt?: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt?: string;
};

/** 发往供应商的单条消息（OpenAI Chat Completions 兼容结构）。 */
export type ProviderChatMessage = {
  /** 消息角色，可为 developer。 */
  role: PromptProviderMessageRole | 'developer';
  /** 消息正文。 */
  content: string;
  /** role 为 tool/assistant 时的归属名。 */
  name?: string;
  /** role 为 tool 时关联的工具调用 ID。 */
  toolCallId?: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/**
 * Prompt 组成段落，是 Builder 可解释输出的最小单元（供预览展示）。
 */
export type PromptSection = {
  /** 段落 ID（Builder 内部分配）。 */
  id: string;
  /** 段落类别。 */
  kind: PromptSectionKind;
  /** 段落逻辑来源。 */
  source: PromptSectionSource;
  /** 展示用标题。 */
  title: string;
  /** 段落正文。 */
  content: string;
  /** 是否最终纳入了 Prompt（被 token 预算裁剪的段落为 false）。 */
  isIncluded: boolean;
  /** 段落顺序号。 */
  order: number;
  /** token 数估算；未估算时为 null。 */
  tokenEstimate?: number | null;
  /** 来源实体 ID（如角色 ID、预设 ID）；运行时段落为 null。 */
  sourceId?: string | null;
  /** 段落被纳入或排除的原因说明。 */
  reason?: string | null;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** Builder 内部逻辑消息（尚未转成供应商口径），记录来源段落以便溯源。 */
export type PromptBuilderMessage = {
  /** 消息角色。 */
  role: PromptInternalMessageRole;
  /** 消息正文。 */
  content: string;
  /** 组成本条消息的段落 ID 列表。 */
  sectionIds: string[];
  /** token 数估算；未估算时为 null。 */
  tokenEstimate?: number | null;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 会话上下文（Builder 输入之一）。 */
export type PromptConversationContext = {
  /** 会话 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 关联角色 ID。 */
  characterId: string;
  /** 会话标题。 */
  title: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 角色上下文（Builder 输入之一）。 */
export type PromptCharacterContext = {
  /** 角色 ID。 */
  id: string;
  /** 角色名。 */
  name: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  /** 场景设定。 */
  scenario: string;
  /** 首条消息（开场白）。 */
  firstMessage: string;
  /** 对话示例。 */
  exampleMessages?: ChatMessageLike[];
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** Persona 上下文（Builder 输入之一）。 */
export type PromptPersonaContext = {
  /** Persona ID。 */
  id: string;
  /** Persona 名称。 */
  name: string;
  /** Persona 正文。 */
  content: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** Prompt 预设上下文（Builder 输入之一）。 */
export type PromptPresetContext = {
  /** 预设 ID。 */
  id: string;
  /** 预设名称。 */
  name: string;
  /** 预设描述。 */
  description: string;
  /** 系统 Prompt 文本。 */
  systemPrompt: string;
  /** 输出约束规则文本。 */
  outputRules: string;
  /** 生成参数；未设置时为 null。 */
  parameters?: PromptModelParameters | null;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 模型生成参数子集（Builder 与 Gateway 共用）。 */
export type PromptModelParameters = {
  /** 采样温度；未设置时为 null。 */
  temperature?: number | null;
  /** top_p；未设置时为 null。 */
  topP?: number | null;
  /** 最大输出 token 数；未设置时为 null。 */
  maxTokens?: number | null;
  /** 请求超时时间（毫秒）；未设置时为 null。 */
  timeout?: number | null;
  /** 频率惩罚；未设置时为 null。 */
  frequencyPenalty?: number | null;
  /** 存在惩罚；未设置时为 null。 */
  presencePenalty?: number | null;
};

/** 模型网关上下文（Builder 输入之一）。 */
export type PromptModelGatewayContext = {
  /** 供应商模型 ID。 */
  id: string;
  /** 模型显示名称。 */
  name: string;
  /** 供应商标识。 */
  providerName: string;
  /** 基础 URL。 */
  baseUrl: string;
  /** 模型名。 */
  modelName: string;
  /** 生成参数；未设置时为 null。 */
  parameters?: PromptModelParameters | null;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 世界书条目上下文（Builder 输入之一）。 */
export type WorldBookEntryContext = {
  /** 条目 ID。 */
  id: string;
  /** 所属世界书 ID。 */
  worldBookId: string;
  /** 条目标题。 */
  title: string;
  /** 条目正文。 */
  content: string;
  /** 主关键词列表。 */
  keywords: string[];
  /** 次关键词列表。 */
  secondaryKeywords?: string[];
  /** 是否启用。 */
  isEnabled: boolean;
  /** 优先级。 */
  priority: number;
  /** 注入位置。 */
  position: WorldBookEntryPosition;
  /** 条目 token 预算上限；未设置时为 null。 */
  tokenBudget?: number | null;
  /** 关键词匹配是否区分大小写。 */
  caseSensitive: boolean;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 世界书上下文（Builder 输入之一），含全部条目。 */
export type WorldBookContext = {
  /** 世界书 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 关联角色 ID；共享世界书为 null。 */
  characterId?: string | null;
  /** 世界书名称。 */
  name: string;
  /** 世界书描述。 */
  description: string;
  /** 是否启用。 */
  isEnabled: boolean;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  /** 扫描深度。 */
  scanDepth: number;
  /** 整本世界书的 token 预算。 */
  tokenBudget: number;
  /** 条目上下文列表。 */
  entries: WorldBookEntryContext[];
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 命中的世界书条目（带命中关键词等调试信息）。 */
export type WorldBookMatchedEntry = {
  /** 所属世界书 ID。 */
  worldBookId: string;
  /** 所属世界书名称。 */
  worldBookName: string;
  /** 条目 ID。 */
  entryId: string;
  /** 条目标题。 */
  title: string;
  /** 条目正文。 */
  content: string;
  /** 主关键词列表。 */
  keywords: string[];
  /** 实际命中的主关键词子集。 */
  matchedKeywords: string[];
  /** 次关键词列表。 */
  secondaryKeywords?: string[];
  /** 实际命中的次关键词子集。 */
  matchedSecondaryKeywords?: string[];
  /** 优先级。 */
  priority: number;
  /** 注入位置。 */
  position: WorldBookEntryPosition;
  /** 实际插入顺序（可能与 position 不同，受排序策略影响）。 */
  insertionOrder: WorldBookEntryPosition;
  /** 条目 token 预算上限；未设置时为 null。 */
  tokenBudget?: number | null;
  /** token 数估算；未估算时为 null。 */
  tokenEstimate?: number | null;
  /** 触发命中的消息 ID 列表。 */
  sourceMessageIds: string[];
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 被跳过的世界书条目及其原因。 */
export type WorldBookSkippedEntry = {
  /** 所属世界书 ID。 */
  worldBookId: string;
  /** 条目 ID。 */
  entryId: string;
  /** 条目标题。 */
  title: string;
  /** 跳过原因。 */
  reason: 'disabled' | 'no_keyword_match' | 'secondary_keyword_miss' | 'token_budget_exceeded';
  /** token 数估算；未估算时为 null。 */
  tokenEstimate?: number | null;
};

/** 世界书匹配的整体结果。 */
export type WorldBookMatchResult = {
  /** 参与关键词匹配的消息 ID 列表。 */
  scannedMessageIds: string[];
  /** 实际使用的扫描深度。 */
  scanDepth: number;
  /** 整体 token 预算。 */
  tokenBudget: number;
  /** 实际使用的 token 估算总和。 */
  usedTokenEstimate: number;
  /** 命中并注入的条目列表。 */
  matchedEntries: WorldBookMatchedEntry[];
  /** 被跳过的条目列表。 */
  skippedEntries: WorldBookSkippedEntry[];
};

/** 因截断被移除的历史消息记录。 */
export type PromptTruncatedHistoryItem = {
  /** 被截断的消息 ID。 */
  messageId: string;
  /** 消息角色（标准 role 之外的字符串视为自定义角色）。 */
  role: PromptMessageRole | string;
  /** 截断原因。 */
  reason: 'history_limit' | 'token_budget';
  /** token 数估算；未估算时为 null。 */
  tokenEstimate?: number | null;
};

/** Builder 产生的告警项。 */
export type PromptBuildWarning = {
  /** 告警码。 */
  code: string;
  /** 给人看的告警描述。 */
  message: string;
  /** 附加详情。 */
  details?: Record<string, unknown>;
};

/** Builder 的调试信息（仅在 includeDebug=true 时填充）。 */
export type BuildPromptDebugInfo = {
  /** 命中的世界书条目。 */
  matchedEntries: WorldBookMatchedEntry[];
  /** 被截断的历史消息。 */
  truncatedHistory: PromptTruncatedHistoryItem[];
  /** 最终发往供应商的消息列表。 */
  finalMessages: ProviderChatMessage[];
  /** 段落顺序（按 ID 串起）。 */
  sectionOrder: string[];
  /** 构建过程中的告警列表。 */
  warnings: PromptBuildWarning[];
  /** 各 Prompt 模块实际纳入内容的 token 估算。 */
  moduleTokenEstimates: Partial<Record<PromptSectionKind, number>>;
  /** 统一输入预算及裁剪结果；不包含任何 Prompt 正文。 */
  budget: {
    promptBudget: number;
    fixedTokenEstimate: number;
    worldBookTokenEstimate: number;
    historyTokenEstimate: number;
    currentUserTokenEstimate: number;
    finalTokenEstimate: number;
    trimmedHistoryCount: number;
  };
  /** 实际解析出的 Preset 参数；不存在 Preset 时为 null。 */
  presetParameters: PromptModelParameters | null;
};

/** Builder 的构建选项。 */
export type PromptBuildOptions = {
  /** 构建模式。 */
  mode: PromptBuildMode;
  /** 默认构建角色回复；候选生成使用 user_suggestions。 */
  purpose?: PromptBuildPurpose;
  /** 历史消息最多取多少条。 */
  historyLimit?: number;
  /** 历史消息总字符数上限。 */
  maxHistoryCharacters?: number;
  /** 整体 Prompt token 上限。 */
  maxPromptTokens?: number;
  /** 是否产出调试信息。 */
  includeDebug?: boolean;
  /** 目标模型是否支持 developer role（影响 system 是否转写为 developer）。 */
  supportsDeveloperRole?: boolean;
};

/** Builder 的完整输入。 */
export type BuildPromptInput = {
  /** 用户 ID。 */
  userId: string;
  /** 会话上下文。 */
  conversation: PromptConversationContext;
  /** 角色上下文。 */
  character: PromptCharacterContext;
  /** Persona 上下文；未绑定时为 null。 */
  persona?: PromptPersonaContext | null;
  /** Prompt 预设上下文；未绑定时为 null。 */
  promptPreset?: PromptPresetContext | null;
  /** 模型网关上下文；未绑定时为 null。 */
  modelGateway?: PromptModelGatewayContext | null;
  /** 历史消息列表（按时间正序）。 */
  history: ChatMessageLike[];
  /** 当前用户输入消息。 */
  currentUserMessage: ChatMessageLike;
  /** 世界书上下文列表。 */
  worldBooks?: WorldBookContext[];
  /** 构建选项。 */
  options: PromptBuildOptions;
};

/** Builder 的构建结果。 */
export type BuildPromptResult = {
  /** 会话 ID。 */
  conversationId: string;
  /** 组成段落列表（可解释输出）。 */
  sections: PromptSection[];
  /** 内部逻辑消息列表。 */
  logicalMessages: PromptBuilderMessage[];
  /** 最终发往供应商的消息列表。 */
  finalMessages: ProviderChatMessage[];
  /** 世界书匹配结果。 */
  worldBook: WorldBookMatchResult;
  /** 被截断的历史消息列表。 */
  truncatedHistory: PromptTruncatedHistoryItem[];
  /** 整体 token 估算；未估算时为 null。 */
  tokenEstimate?: number | null;
  /** 调试信息。 */
  debug: BuildPromptDebugInfo;
};

/** 单次 Prompt 预览的构建结果（带生成时间）。 */
export type PromptPreviewResult = {
  /** 会话 ID。 */
  conversationId: string;
  /** 生成时间（ISO 字符串）。 */
  generatedAt: string;
  /** 构建结果。 */
  result: BuildPromptResult;
};

/** Prompt 预览接口的入参。 */
export type PromptPreviewPayload = {
  /** 会话 ID。 */
  conversationId: string;
  /** 模拟的用户输入文本。 */
  userInput: string;
  /** 历史消息最多取多少条。 */
  historyLimit?: number;
  /** 历史消息总字符数上限。 */
  maxHistoryCharacters?: number;
  /** 目标模型是否支持 developer role。 */
  supportsDeveloperRole?: boolean;
};

/** 历史消息截断的汇总信息（供预览展示截断了多少）。 */
export type PromptHistoryTrimInfo = {
  /** 请求的历史条数上限。 */
  requestedHistoryLimit: number;
  /** 请求的历史字符数上限。 */
  requestedMaxHistoryCharacters: number;
  /** 实际可用的历史消息条数。 */
  availableHistoryCount: number;
  /** 实际使用的历史消息条数。 */
  usedHistoryCount: number;
  /** 被截断的消息条数。 */
  truncatedCount: number;
  /** 被截断的消息列表。 */
  truncatedHistory: PromptTruncatedHistoryItem[];
};

/** Prompt 预览专用的世界书调试信息（比匹配结果更面向展示）。 */
export type PromptPreviewWorldBookDebug = {
  /** 扫描深度。 */
  scanDepth: number;
  /** 整体 token 预算。 */
  tokenBudget: number;
  /** 实际使用的 token 估算总和。 */
  usedTokenEstimate: number;
  /** 参与匹配的消息 ID 列表。 */
  scannedMessageIds: string[];
  /** 命中条目数。 */
  matchedCount: number;
  /** 跳过条目数。 */
  skippedCount: number;
  /** 命中条目列表。 */
  matchedEntries: WorldBookMatchedEntry[];
  /** 跳过条目列表。 */
  skippedEntries: WorldBookSkippedEntry[];
  /** 最终注入的段落列表。 */
  insertedSections: Array<{
    /** 段落 ID。 */
    sectionId: string;
    /** 来源条目 ID；运行时段落为 null。 */
    entryId: string | null;
    /** 展示用标题。 */
    title: string;
    /** 插入顺序；运行时段落为 null。 */
    insertionOrder: WorldBookEntryPosition | null;
    /** 段落顺序号。 */
    order: number;
    /** token 数估算；未估算时为 null。 */
    tokenEstimate?: number | null;
  }>;
};

/** Prompt 预览接口的完整响应体（前端预览页直接消费）。 */
export type PromptPreviewResponse = {
  /** 会话 ID。 */
  conversationId: string;
  /** 生成时间（ISO 字符串）。 */
  generatedAt: string;
  /** 组成段落列表。 */
  sections: PromptSection[];
  /** 内部逻辑消息列表。 */
  logicalMessages: PromptBuilderMessage[];
  /** 最终发往供应商的消息列表。 */
  finalMessages: ProviderChatMessage[];
  /** 世界书匹配结果。 */
  worldBook: WorldBookMatchResult;
  /** 世界书调试信息。 */
  worldBookDebug: PromptPreviewWorldBookDebug;
  /** 历史消息截断汇总。 */
  historyTrimInfo: PromptHistoryTrimInfo;
  /** 整体 token 估算；未估算时为 null。 */
  tokenEstimate?: number | null;
  /** 通用调试信息。 */
  debug: BuildPromptDebugInfo;
};
