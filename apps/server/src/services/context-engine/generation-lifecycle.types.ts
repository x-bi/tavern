import type { CompanionMessage, Message } from '@prisma/client';

export type GenerationPurpose =
  | 'chat_reply'
  | 'regenerate'
  | 'continue'
  | 'user_suggestions'
  | 'memory_summary';

export type PreparedGeneration<TMessage extends Message | CompanionMessage> =
  | {
      state: 'idempotent_complete';
      messageId: string;
    }
  | {
      state: 'started';
      requestDatabaseId: string;
      turnId: string;
      expectedVersion: number;
      purpose: GenerationPurpose;
      userMessage: TMessage;
      assistantMessage: TMessage;
    };

export type ProposedPromptSectionTrace = {
  sectionId: string;
  sectionKind: string;
  sourceType: string;
  sourceId?: string | null;
  sourceRevisionId?: string | null;
  contentHash: string;
  compactUsed: boolean;
  placement: string;
  conversationRole?: string | null;
  finalProviderRole?: string | null;
  tokenEstimate: number;
  included: boolean;
  excludedReason?: string | null;
};

export type ProposedWorldBookTrace = {
  entryId: string;
  entryRevisionId: string;
  activationSource: string;
  sourceMessageId?: string | null;
  rootUserMessageId: string;
  lineageJson: string;
  bridgeDepth: number;
};

export type ProposedWorldBookStateChange = {
  entryId: string;
  entryRevisionId: string;
  operation: 'upsert' | 'clear';
  sourceKey: string;
  payload: Record<string, unknown>;
};

export type ProposedContextCommit = {
  generationTrace: ProposedGenerationTrace;
  promptSectionTraces: ProposedPromptSectionTrace[];
  includedWorldBookTraces: ProposedWorldBookTrace[];
  worldBookStateChanges: ProposedWorldBookStateChange[];
  memoryRevisionIdUsed?: string | null;
};

export type ProposedGenerationTrace = {
  requestUserMessageId: string;
  rootUserMessageId: string;
  modelId: string;
  compilerVersion: string;
  promptSnapshotJson: string;
  promptSnapshotHash: string;
  capabilitiesSnapshotJson: string;
  modelParametersJson: string;
  memoryRevisionIdUsed?: string | null;
  sections: ProposedPromptSectionTrace[];
  includedWorldBooks?: ProposedWorldBookTrace[];
  worldBookStateChanges?: ProposedWorldBookStateChange[];
};
