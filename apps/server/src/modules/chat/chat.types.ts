import type {
  Character,
  Conversation,
  ModelConfig,
  PromptPreset,
  UserPersona
} from '@prisma/client';

export type ChatConversation = Conversation & {
  character: Character;
  modelConfig: ModelConfig | null;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

export type ChatSseEventName = 'delta' | 'done' | 'error';

export type ChatSseEventPayload = Record<string, unknown>;

export type ChatTask = {
  conversationId: string;
  assistantMessageId: string | null;
  abortController: AbortController;
};

export type ChatMessageMetadata = {
  source?: 'chat-stream';
  requestMessageId?: string;
  regenerateOfMessageId?: string;
  regeneratedAt?: string;
  regeneratedByMessageId?: string;
  error?: {
    code: string;
    message: string;
  };
  aborted?: boolean;
  stopped?: boolean;
};

export type ChatResponseLike = {
  writableEnded: boolean;
  destroyed?: boolean;
  status(code: number): ChatResponseLike;
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  end(): void;
  on(event: 'close', listener: () => void): void;
  off(event: 'close', listener: () => void): void;
};
