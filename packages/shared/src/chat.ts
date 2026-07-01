export type ChatStreamPayload = {
  conversationId: string;
  userMessage?: string;
  regenerateMessageId?: string;
  modelConfigId?: string | null;
  presetId?: string | null;
  historyLimit?: number;
  maxHistoryCharacters?: number;
};

export type ChatStreamDeltaEvent = {
  text: string;
  messageId: string;
};

export type ChatStreamDoneEvent = {
  messageId: string;
  finishReason: string | null;
};

export type ChatStreamErrorEvent = {
  code: string;
  message: string;
};
