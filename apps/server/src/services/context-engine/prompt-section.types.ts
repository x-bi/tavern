import type { ProviderChatMessage } from '../prompt-builder/types';
import type { GenerationPurpose } from './generation-lifecycle.types';

export type PromptCapabilities = {
  supportsDeveloperRole: boolean;
  systemPlacement: 'initial_only' | 'midstream_allowed';
  supportsMultipleSystemMessages: boolean;
  requiresAlternatingRoles: boolean;
  contextWindowTokens: number;
  tokenizerType: string;
};
export type PromptSectionV2 = {
  id: string;
  kind: string;
  sourceType: string;
  sourceId?: string;
  sourceRevisionId?: string;
  content: string;
  compactContent?: string;
  compactSourceHash?: string;
  placement:
    | 'instruction'
    | 'before_history'
    | 'history'
    | 'after_history'
    | 'before_current_user'
    | 'current_user';
  importance: 'required' | 'reserved' | 'optional';
  budgetPriority: number;
  sortOrder: number;
  truncationPolicy: 'never' | 'use_compact' | 'drop';
  generationPurposes: GenerationPurpose[];
  conversationRole?: 'user' | 'assistant' | 'tool';
  contentType?: 'lore' | 'state' | 'behavior_rule' | 'reference';
  trustLevel?: 'system' | 'user_authored' | 'imported_untrusted' | 'user_confirmed_import';
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
