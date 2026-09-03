import type { ProviderChatMessage } from './prompt-builder';

export type GenerationPurpose =
  | 'chat_reply'
  | 'regenerate'
  | 'continue'
  | 'proactive_chat'
  | 'user_suggestions'
  | 'memory_summary';
export type ExecutionMode = 'commit' | 'dry_run';
export type PromptSectionKindV2 =
  | 'platform_policy'
  | 'runtime_context'
  | 'mode_policy'
  | 'preset_instruction'
  | 'preset_output_rule'
  | 'character_core'
  | 'character_personality'
  | 'character_premise'
  | 'character_initial_scenario'
  | 'character_background'
  | 'character_rule'
  | 'persona_core'
  | 'persona_background'
  | 'persona_preference'
  | 'companion_core'
  | 'companion_personality'
  | 'companion_style'
  | 'companion_runtime_state'
  | 'companion_memory'
  | 'world_book'
  | 'history'
  | 'generation_hint'
  | 'current_user';
export type PromptPlacementV2 =
  | 'instruction'
  | 'before_history'
  | 'history'
  | 'after_history'
  | 'before_current_user'
  | 'current_user';
export type PromptImportance = 'required' | 'reserved' | 'optional';
export type WorldBookContentType = 'lore' | 'state' | 'behavior_rule' | 'reference';
export type ContentTrustLevel =
  | 'system'
  | 'user_authored'
  | 'imported_untrusted'
  | 'user_confirmed_import';
export type PromptSectionV2 = {
  id: string;
  kind: PromptSectionKindV2;
  sourceType: string;
  sourceId?: string;
  sourceRevisionId?: string;
  content: string;
  compactContent?: string;
  compactSourceHash?: string;
  placement: PromptPlacementV2;
  importance: PromptImportance;
  budgetPriority: number;
  sortOrder: number;
  truncationPolicy: 'never' | 'use_compact' | 'drop';
  generationPurposes: GenerationPurpose[];
  conversationRole?: 'user' | 'assistant' | 'tool';
  contentType?: WorldBookContentType;
  trustLevel?: ContentTrustLevel;
};
export type PromptCapabilities = {
  supportsDeveloperRole: boolean;
  systemPlacement: 'initial_only' | 'midstream_allowed';
  supportsMultipleSystemMessages: boolean;
  requiresAlternatingRoles: boolean;
  contextWindowTokens: number;
  tokenizerType: string;
};
export type CompiledPromptSection = {
  section: PromptSectionV2;
  included: boolean;
  compactUsed: boolean;
  tokenEstimate: number;
  excludedReason: string | null;
  finalProviderRole: ProviderChatMessage['role'] | null;
};
export type CompiledPrompt = {
  messages: ProviderChatMessage[];
  sections: CompiledPromptSection[];
  tokenEstimate: number;
  compilerVersion: string;
};
