import { requestJson } from './http';
import type {
  WorldBookEntryPayload,
  WorldBookEntryResponse,
  WorldBookEntryUpdatePayload,
  WorldBookListResponse,
  WorldBookPayload,
  WorldBookResponse,
  WorldBookUpdatePayload
} from '@tavern/shared';

export type WorldBook = WorldBookResponse;
export type WorldBookEntry = WorldBookEntryResponse;
export type WorldBookMutationPayload = WorldBookUpdatePayload & {
  name?: string;
};
export type WorldBookEntryMutationPayload = WorldBookEntryUpdatePayload;

export type WorldBookListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  characterId?: string;
  isEnabled?: boolean;
};

export type WorldBookDeleteResult = {
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

export async function fetchWorldBooks(
  params: WorldBookListParams = {}
): Promise<WorldBookListResponse> {
  const response = await requestJson<WorldBookListResponse>(`/world-books${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function fetchWorldBook(id: string): Promise<WorldBookResponse> {
  const response = await requestJson<WorldBookResponse>(`/world-books/${id}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createWorldBook(payload: WorldBookPayload): Promise<WorldBookResponse> {
  const response = await requestJson<WorldBookResponse>('/world-books', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateWorldBook(
  id: string,
  payload: WorldBookMutationPayload
): Promise<WorldBookResponse> {
  const response = await requestJson<WorldBookResponse>(`/world-books/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteWorldBook(id: string): Promise<WorldBookDeleteResult> {
  const response = await requestJson<WorldBookDeleteResult>(`/world-books/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createWorldBookEntry(
  worldBookId: string,
  payload: WorldBookEntryPayload
): Promise<WorldBookEntryResponse> {
  const response = await requestJson<WorldBookEntryResponse>(
    `/world-books/${worldBookId}/entries`,
    {
      method: 'POST',
      body: payload
    }
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateWorldBookEntry(
  id: string,
  payload: WorldBookEntryMutationPayload
): Promise<WorldBookEntryResponse> {
  const response = await requestJson<WorldBookEntryResponse>(`/world-book-entries/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteWorldBookEntry(id: string): Promise<WorldBookDeleteResult> {
  const response = await requestJson<WorldBookDeleteResult>(`/world-book-entries/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

function toQueryString(params: WorldBookListParams): string {
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

  if (params.isEnabled !== undefined) {
    query.set('isEnabled', String(params.isEnabled));
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
