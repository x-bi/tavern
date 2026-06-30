import type { PageResult } from './pagination';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type MessageStatus = 'complete' | 'edited' | 'deleted' | 'generating' | 'failed';

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
  status?: Extract<MessageStatus, 'complete' | 'edited' | 'failed'>;
  metadata?: Record<string, unknown> | null;
  tokenCount?: number | null;
};

export type MessageRegenerateResponse = {
  regenerated: false;
  id: string;
  reason: 'NOT_IMPLEMENTED';
  message: string;
};
