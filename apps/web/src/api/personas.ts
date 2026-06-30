import { requestJson } from './http';
import type { PersonaListResponse, PersonaPayload, PersonaResponse } from '@tavern/shared';

export type Persona = PersonaResponse;
export type PersonaMutationPayload = Partial<PersonaPayload> & {
  name?: string;
};

export type PersonaListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isDefault?: boolean;
};

export type PersonaDeleteResult = {
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

export async function fetchPersonas(
  params: PersonaListParams = {}
): Promise<PersonaListResponse> {
  const response = await requestJson<PersonaListResponse>(`/personas${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createPersona(payload: PersonaPayload): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>('/personas', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updatePersona(
  id: string,
  payload: PersonaMutationPayload
): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>(`/personas/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deletePersona(id: string): Promise<PersonaDeleteResult> {
  const response = await requestJson<PersonaDeleteResult>(`/personas/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function setDefaultPersona(id: string): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>(`/personas/${id}/set-default`, {
    method: 'POST'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

function toQueryString(params: PersonaListParams): string {
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

  if (params.isDefault !== undefined) {
    query.set('isDefault', String(params.isDefault));
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
