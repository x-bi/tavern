import { requestJson } from './http';
import type {
  ConversationClearResponse,
  ConversationListResponse,
  ConversationPayload,
  ConversationResponse,
  ConversationUpdatePayload
} from '@tavern/shared';

export type Conversation = ConversationResponse;
export type ConversationMutationPayload = ConversationUpdatePayload;

export type ConversationListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  characterId?: string;
  modelConfigId?: string;
  promptPresetId?: string;
  personaId?: string;
  status?: string;
};

export type ConversationDeleteResult = {
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

export async function fetchConversations(
  params: ConversationListParams = {}
): Promise<ConversationListResponse> {
  const response = await requestJson<ConversationListResponse>(
    `/conversations${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createConversation(
  payload: ConversationPayload
): Promise<ConversationResponse> {
  const response = await requestJson<ConversationResponse>('/conversations', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateConversation(
  id: string,
  payload: ConversationMutationPayload
): Promise<ConversationResponse> {
  const response = await requestJson<ConversationResponse>(`/conversations/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteConversation(id: string): Promise<ConversationDeleteResult> {
  const response = await requestJson<ConversationDeleteResult>(`/conversations/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function clearConversation(id: string): Promise<ConversationClearResponse> {
  const response = await requestJson<ConversationClearResponse>(`/conversations/${id}/clear`, {
    method: 'POST'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

function toQueryString(params: ConversationListParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params.search) {
    query.set('search', params.search);
  }

  if (params.characterId) {
    query.set('characterId', params.characterId);
  }

  if (params.modelConfigId) {
    query.set('modelConfigId', params.modelConfigId);
  }

  if (params.promptPresetId) {
    query.set('promptPresetId', params.promptPresetId);
  }

  if (params.personaId) {
    query.set('personaId', params.personaId);
  }

  if (params.status) {
    query.set('status', params.status);
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
