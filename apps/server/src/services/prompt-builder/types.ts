export type PromptBuildMode = 'chat' | 'preview';

export type PromptProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type PromptInternalMessageRole = PromptProviderMessageRole | 'developer';

export type PromptMessageRole = PromptInternalMessageRole;

export type PromptSectionKind =
  | 'platform'
  | 'character'
  | 'persona'
  | 'prompt_preset'
  | 'worldbook'
  | 'history'
  | 'current_user_input'
  | 'output_rules';

export type PromptSectionSource =
  | 'system'
  | 'character'
  | 'persona'
  | 'prompt_preset'
  | 'worldbook'
  | 'message'
  | 'runtime';

export type WorldBookEntryPosition =
  | 'before_history'
  | 'after_history'
  | 'before_current_user_input'
  | 'after_current_user_input';

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

export type ProviderChatMessage = {
  role: PromptProviderMessageRole | 'developer';
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown> | null;
};

export type PromptSection = {
  id: string;
  kind: PromptSectionKind;
  source: PromptSectionSource;
  title: string;
  content: string;
  isIncluded: boolean;
  order: number;
  tokenEstimate?: number | null;
  sourceId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PromptBuilderMessage = {
  role: PromptInternalMessageRole;
  content: string;
  sectionIds: string[];
  tokenEstimate?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type PromptConversationContext = {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

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

export type PromptPersonaContext = {
  id: string;
  name: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export type PromptPresetContext = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  outputRules: string;
  parameters?: PromptModelParameters | null;
  metadata?: Record<string, unknown> | null;
};

export type PromptModelParameters = {
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
};

export type PromptModelConfigContext = {
  id: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  parameters?: PromptModelParameters | null;
  metadata?: Record<string, unknown> | null;
};

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

export type WorldBookContext = {
  id: string;
  userId: string;
  characterId?: string | null;
  name: string;
  description: string;
  isEnabled: boolean;
  scanDepth: number;
  tokenBudget: number;
  entries: WorldBookEntryContext[];
  metadata?: Record<string, unknown> | null;
};

export type WorldBookMatchedEntry = {
  worldBookId: string;
  worldBookName: string;
  entryId: string;
  title: string;
  content: string;
  keywords: string[];
  matchedKeywords: string[];
  secondaryKeywords?: string[];
  matchedSecondaryKeywords?: string[];
  priority: number;
  position: WorldBookEntryPosition;
  insertionOrder: WorldBookEntryPosition;
  tokenBudget?: number | null;
  tokenEstimate?: number | null;
  sourceMessageIds: string[];
  metadata?: Record<string, unknown> | null;
};

export type WorldBookSkippedEntry = {
  worldBookId: string;
  entryId: string;
  title: string;
  reason: 'disabled' | 'no_keyword_match' | 'secondary_keyword_miss' | 'token_budget_exceeded';
  tokenEstimate?: number | null;
};

export type WorldBookMatchResult = {
  scannedMessageIds: string[];
  scanDepth: number;
  tokenBudget: number;
  usedTokenEstimate: number;
  matchedEntries: WorldBookMatchedEntry[];
  skippedEntries: WorldBookSkippedEntry[];
};

export type PromptTruncatedHistoryItem = {
  messageId: string;
  role: PromptMessageRole | string;
  reason: 'history_limit' | 'token_budget';
  tokenEstimate?: number | null;
};

export type PromptBuildWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type BuildPromptDebugInfo = {
  matchedEntries: WorldBookMatchedEntry[];
  truncatedHistory: PromptTruncatedHistoryItem[];
  finalMessages: ProviderChatMessage[];
  sectionOrder: string[];
  warnings: PromptBuildWarning[];
};

export type PromptBuildOptions = {
  mode: PromptBuildMode;
  historyLimit?: number;
  maxHistoryCharacters?: number;
  maxPromptTokens?: number;
  includeDebug?: boolean;
  supportsDeveloperRole?: boolean;
};

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

export type BuildPromptResult = {
  conversationId: string;
  sections: PromptSection[];
  logicalMessages: PromptBuilderMessage[];
  finalMessages: ProviderChatMessage[];
  worldBook: WorldBookMatchResult;
  truncatedHistory: PromptTruncatedHistoryItem[];
  tokenEstimate?: number | null;
  debug: BuildPromptDebugInfo;
};

export type PromptPreviewResult = {
  conversationId: string;
  generatedAt: string;
  result: BuildPromptResult;
};

export type PromptPreviewPayload = {
  conversationId: string;
  userInput: string;
  historyLimit?: number;
  maxHistoryCharacters?: number;
  supportsDeveloperRole?: boolean;
};

export type PromptHistoryTrimInfo = {
  requestedHistoryLimit: number;
  requestedMaxHistoryCharacters: number;
  availableHistoryCount: number;
  usedHistoryCount: number;
  truncatedCount: number;
  truncatedHistory: PromptTruncatedHistoryItem[];
};

export type PromptPreviewResponse = {
  conversationId: string;
  generatedAt: string;
  sections: PromptSection[];
  logicalMessages: PromptBuilderMessage[];
  finalMessages: ProviderChatMessage[];
  worldBook: WorldBookMatchResult;
  historyTrimInfo: PromptHistoryTrimInfo;
  tokenEstimate?: number | null;
  debug: BuildPromptDebugInfo;
};
