import { requestJson } from './http';
import type {
  ModelConfigListResponse,
  ModelConfigPayload,
  ModelConfigResponse,
  ModelConfigTestResponse
} from '@tavern/shared';

export type ModelConfig = ModelConfigResponse;
export type ModelConfigMutationPayload = Partial<ModelConfigPayload> & {
  name?: string;
  providerName?: string;
  baseUrl?: string;
  modelName?: string;
};

export type ModelConfigListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isEnabled?: boolean;
};

export type ModelConfigDeleteResult = {
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

export async function fetchModelConfigs(
  params: ModelConfigListParams = {}
): Promise<ModelConfigListResponse> {
  const response = await requestJson<ModelConfigListResponse>(
    `/model-configs${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

export async function createModelConfig(
  payload: ModelConfigPayload
): Promise<ModelConfigResponse> {
  const response = await requestJson<ModelConfigResponse>('/model-configs', {
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

export async function updateModelConfig(
  id: string,
  payload: ModelConfigMutationPayload
): Promise<ModelConfigResponse> {
  const response = await requestJson<ModelConfigResponse>(`/model-configs/${id}`, {
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

export async function deleteModelConfig(id: string): Promise<ModelConfigDeleteResult> {
  const response = await requestJson<ModelConfigDeleteResult>(`/model-configs/${id}`, {
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

export async function testModelConfigConnection(id: string): Promise<ModelConfigTestResponse> {
  const response = await requestJson<ModelConfigTestResponse>(`/model-configs/${id}/test`, {
    method: 'POST'
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

function toQueryString(params: ModelConfigListParams): string {
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

  if (params.isEnabled !== undefined) {
    query.set('isEnabled', String(params.isEnabled));
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
