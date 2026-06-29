import { requestJson } from './http';
import type {
  CharacterMetadata,
  CharacterMutationPayload,
  ExampleMessage
} from '../types/character';

export type Character = {
  id: string;
  userId: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: CharacterMetadata | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CharacterListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isArchived?: boolean;
};

export type CharacterListResult = {
  items: Character[];
  total: number;
  page: number;
  pageSize: number;
};

export type CharacterDeleteResult = {
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

export async function fetchCharacters(
  params: CharacterListParams = {}
): Promise<CharacterListResult> {
  const response = await requestJson<CharacterListResult>(`/characters${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

export async function fetchCharacter(id: string): Promise<Character> {
  const response = await requestJson<Character>(`/characters/${id}`);

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

export async function createCharacter(payload: CharacterMutationPayload): Promise<Character> {
  const response = await requestJson<Character>('/characters', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

export async function updateCharacter(
  id: string,
  payload: CharacterMutationPayload
): Promise<Character> {
  const response = await requestJson<Character>(`/characters/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

export async function deleteCharacter(id: string): Promise<CharacterDeleteResult> {
  const response = await requestJson<CharacterDeleteResult>(`/characters/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

function toQueryString(params: CharacterListParams): string {
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

  if (params.isArchived !== undefined) {
    query.set('isArchived', String(params.isArchived));
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
