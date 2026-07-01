import type { PageResult } from './pagination';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type MessageStatus =
  | 'complete'
  | 'edited'
  | 'deleted'
  | 'generating'
  | 'failed'
  | 'stopped';

export type MessageResponse = {
  id: string;
  conversationId: string;
  role: MessageRole | string;
  content: string;
  status: MessageStatus | string;
  metadata: Record<string, unknown> | null;
  tokenCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageListResponse = PageResult<MessageResponse>;

export type MessageUpdatePayload = {
  content?: string;
  status?: Extract<MessageStatus, 'complete' | 'edited' | 'failed' | 'stopped'>;
  metadata?: Record<string, unknown> | null;
  tokenCount?: number | null;
};

export type MessageRegenerateResponse = {
  id: string;
  conversationId: string;
  regenerateMessageId: string;
  replaceStrategy: 'soft-delete-target';
  streamPath: '/chat/stream';
  message: string;
};
