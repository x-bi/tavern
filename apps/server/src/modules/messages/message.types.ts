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

export type MessageListResponse = {
  items: MessageResponse[];
  total: number;
  page: number;
  pageSize: number;
};

export type MessageRegenerateResponse = {
  id: string;
  conversationId: string;
  regenerateMessageId: string;
  replaceStrategy: 'soft-delete-target';
  streamPath: '/chat/stream';
  message: string;
};
