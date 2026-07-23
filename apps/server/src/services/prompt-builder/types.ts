import type { CompiledPromptSection } from '../context-engine/prompt-section.types';
import type { GenerationPurpose } from '../context-engine/generation-lifecycle.types';

/** Prompt 构建模式：chat 实际对话 / preview 预览调试。 */
export type PromptBuildMode = 'chat' | 'preview';

/** Prompt 的实际任务用途；preview 仍可预览任一用途。 */
export type PromptBuildPurpose = 'chat_reply' | 'user_suggestions';

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

/** 世界书条目 V2 注入位置。 */
export type WorldBookPlacement =
  | 'instruction'
  | 'before_history'
  | 'after_history'
  | 'before_current_user';

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
  coreIdentity: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  firstMessage: string;
  exampleMessages?: ChatMessageLike[];
  metadata?: Record<string, unknown> | null;
};

/** 用户人设上下文。 */
export type PromptPersonaContext = {
  id: string;
  name: string;
  coreIdentity: string;
  background: string;
  interactionPreferences: string;
  metadata?: Record<string, unknown> | null;
};

/** 预设上下文。 */
export type PromptPresetContext = {
  id: string;
  name: string;
  description: string;
  instructions: string[];
  outputRuleOperations: Array<{
    key: string;
    content: string;
    operation: 'add' | 'replace_optional' | 'disable_optional';
    sortOrder: number;
  }>;
  generationPurposes: GenerationPurpose[];
  parameters?: PromptModelParameters | null;
  metadata?: Record<string, unknown> | null;
};

/** 模型调用参数。 */
export type PromptModelParameters = {
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
  /** 频率惩罚（0~2），抑制已出现 token 重复，缓解套话循环。 */
  frequencyPenalty?: number | null;
  /** 存在惩罚（0~2），鼓励引入新内容，缓解长会话同质化。 */
  presencePenalty?: number | null;
};

/** 模型网关上下文。 */
export type PromptModelGatewayContext = {
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
  activeRevisionId: string;
  worldBookId: string;
  title: string;
  content: string;
  compactContent?: string | null;
  compactSourceHash?: string | null;
  keywords: string[];
  secondaryKeywords?: string[];
  isEnabled: boolean;
  budgetPriority: number;
  sortOrder: number;
  placement: WorldBookPlacement;
  maxTokens?: number | null;
  config: Record<string, unknown>;
};

/** 世界书上下文（含其条目）。 */
export type WorldBookContext = {
  id: string;
  userId: string;
  /** 关联角色 ID 列表；为空时为全局世界书。 */
  characterIds?: string[];
  personaIds?: string[];
  conversationIds?: string[];
  companionIds?: string[];
  name: string;
  description: string;
  isEnabled: boolean;
  isSensitive: boolean;
  /** 扫描深度：扫描最近多少条消息触发关键词。 */
  scanDepth: number;
  /** token 预算：世界书条目总 token 上限。 */
  tokenBudget: number;
  entries: WorldBookEntryContext[];
  metadata?: Record<string, unknown> | null;
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
  truncatedHistory: PromptTruncatedHistoryItem[];
  finalMessages: ProviderChatMessage[];
  sectionOrder: string[];
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

/** 构建选项。 */
export type PromptBuildOptions = {
  mode: PromptBuildMode;
  /** 默认构建角色回复；候选生成必须显式使用 user_suggestions。 */
  purpose?: PromptBuildPurpose;
  historyLimit?: number;
  maxHistoryCharacters?: number;
  maxPromptTokens?: number;
  /** 是否包含调试信息。 */
  includeDebug?: boolean;
  /** 模型是否支持 developer 角色。 */
  supportsDeveloperRole?: boolean;
};

/** Prompt 构建输入（会话/角色/人设/预设/模型网关/历史/当前输入/世界书/选项）。 */
export type BuildPromptInput = {
  userId: string;
  conversation: PromptConversationContext;
  character: PromptCharacterContext;
  persona?: PromptPersonaContext | null;
  promptPreset?: PromptPresetContext | null;
  modelGateway?: PromptModelGatewayContext | null;
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  worldBooks?: WorldBookContext[];
  options: PromptBuildOptions;
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

/** 预览响应中的世界书调试信息（V2 运行时决策 + Provider 编译后实际插入的唯一来源）。 */
export type PromptPreviewWorldBookDebug = {
  /** 候选条目数（启用且含 active revision 的条目总数）。 */
  candidateCount: number;
  /** 运行时激活（命中）的条目数。 */
  matchedCount: number;
  /** 运行时未激活（跳过）的条目数。 */
  skippedCount: number;
  /** 喂给 V2 匹配器的消息 ID 列表。 */
  scannedMessageIds: string[];
  /** 本次扫描使用的 user_history 深度。 */
  scanDepth: number;
  /** 每个候选条目的运行时决策（含未命中条目，included 表示运行时是否激活）。 */
  decisions: Array<{
    worldBookId: string;
    entryId: string;
    revisionId: string;
    title: string;
    /** 运行时是否激活（true=命中/常驻/Sticky/Continuation/Manual；不含预算裁剪）。 */
    included: boolean;
    activationSource: string | null;
    reason: string | null;
    sourceMessageId: string | null;
    placement: string;
    contentType: string;
    trustLevel: string;
    budgetPriority: number;
    sortOrder: number;
    /** 命中条目的 token 估算（来自最终 section）；未命中条目为 null。 */
    tokenEstimate: number | null;
  }>;
  /** 最终插入 Provider Prompt 的世界书 section（命中条目中实际纳入的子集，可能因预算裁剪少于 matchedCount）。 */
  insertedSections: Array<{
    sectionId: string;
    worldBookId: string;
    entryId: string;
    revisionId: string;
    title: string;
    placement: string;
    contentType: string;
    budgetPriority: number;
    sortOrder: number;
    tokenEstimate: number;
  }>;
};

/** Prompt 预览接口响应。 */
export type PromptPreviewResponse = {
  conversationId: string;
  generatedAt: string;
  dryRun: true;
  compilerVersion: string;
  promptSnapshotHash: string;
  compiledSections: CompiledPromptSection[];
  finalMessages: ProviderChatMessage[];
  worldBookDebug: PromptPreviewWorldBookDebug;
  historyTrimInfo: PromptHistoryTrimInfo;
  tokenEstimate?: number | null;
  debug: BuildPromptDebugInfo;
};
