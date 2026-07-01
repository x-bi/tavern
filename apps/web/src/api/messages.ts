import { requestJson } from './http';
import type {
  MessageListResponse,
  MessageRegenerateResponse,
  MessageResponse,
  MessageRole,
  MessageStatus,
  MessageUpdatePayload
} from '@tavern/shared';

export type Message = MessageResponse;
export type MessageMutationPayload = MessageUpdatePayload;

export type MessageListParams = {
  page?: number;
  pageSize?: number;
  order?: 'asc' | 'desc';
  role?: MessageRole;
  status?: MessageStatus | string;
  search?: string;
};

export type MessageDeleteResult = {
  deleted: true;
  id: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function fetchConversationMessages(
  conversationId: string,
  params: MessageListParams = {}
): Promise<MessageListResponse> {
  const response = await requestJson<MessageListResponse>(
    `/conversations/${conversationId}/messages${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateMessage(
  id: string,
  payload: MessageMutationPayload
): Promise<MessageResponse> {
  const response = await requestJson<MessageResponse>(`/messages/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteMessage(id: string): Promise<MessageDeleteResult> {
  const response = await requestJson<MessageDeleteResult>(`/messages/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function regenerateMessage(id: string): Promise<MessageRegenerateResponse> {
  const response = await requestJson<MessageRegenerateResponse>(`/messages/${id}/regenerate`, {
    method: 'POST'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

function toQueryString(params: MessageListParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params.order !== undefined) {
    query.set('order', params.order);
  }

  if (params.role) {
    query.set('role', params.role);
  }

  if (params.status) {
    query.set('status', params.status);
  }

  if (params.search) {
    query.set('search', params.search);
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
