import { requestJson } from './http';
import type {
  PromptPresetListResponse,
  PromptPresetPayload,
  PromptPresetResponse
} from '@tavern/shared';

export type PromptPreset = PromptPresetResponse;
export type PromptPresetMutationPayload = Partial<PromptPresetPayload> & {
  name?: string;
};

export type PromptPresetListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isDefault?: boolean;
};

export type PromptPresetDeleteResult = {
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

export async function fetchPromptPresets(
  params: PromptPresetListParams = {}
): Promise<PromptPresetListResponse> {
  const response = await requestJson<PromptPresetListResponse>(
    `/prompt-presets${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createPromptPreset(
  payload: PromptPresetPayload
): Promise<PromptPresetResponse> {
  const response = await requestJson<PromptPresetResponse>('/prompt-presets', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updatePromptPreset(
  id: string,
  payload: PromptPresetMutationPayload
): Promise<PromptPresetResponse> {
  const response = await requestJson<PromptPresetResponse>(`/prompt-presets/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deletePromptPreset(id: string): Promise<PromptPresetDeleteResult> {
  const response = await requestJson<PromptPresetDeleteResult>(`/prompt-presets/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

function toQueryString(params: PromptPresetListParams): string {
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
