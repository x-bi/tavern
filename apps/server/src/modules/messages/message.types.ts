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

export type MessageListResponse = {
  items: MessageResponse[];
  total: number;
  page: number;
  pageSize: number;
};

export type MessageRegenerateResponse = {
  regenerated: false;
  id: string;
  reason: 'NOT_IMPLEMENTED';
  message: string;
};
