/**
 * 模型 API 封装（供应商 / 模型 / 模型链，路由前缀 /model-providers 等）。
 *
 * 提供 CRUD 与连通性测试；类型主要复用 shared 包。
 */
import { requestJson } from './http';
import type {
  ModelConnectionTestResponse,
  ModelFallbackGroupListResponse,
  ModelFallbackGroupPayload,
  ModelFallbackGroupResponse,
  ModelProviderListResponse,
  ModelProviderPayload,
  ModelProviderResponse,
  ProviderModelListResponse,
  ProviderModelPayload,
  ProviderModelResponse,
  SupportedModelProvidersResponse
} from '@tavern/shared';

export type ModelProvider = ModelProviderResponse;
export type ProviderModel = ProviderModelResponse;
export type ModelFallbackGroup = ModelFallbackGroupResponse;
export type ModelProviderMutationPayload = Partial<ModelProviderPayload>;
export type ProviderModelMutationPayload = Partial<ProviderModelPayload>;
export type ModelFallbackGroupMutationPayload = Partial<ModelFallbackGroupPayload>;

/** 模型资源列表查询参数，所有字段可选。 */
export type ModelResourceListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 按启用状态过滤。 */
  isEnabled?: boolean;
};

/** 删除模型资源的结果。 */
export type ModelDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的模型资源 ID。 */
  id: string;
};

/**
 * API 客户端错误：后端返回失败响应时抛出，携带业务错误码与可选详情。
 */
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

export async function fetchModelProviders(
  params: ModelResourceListParams = {}
): Promise<ModelProviderListResponse> {
  const response = await requestJson<ModelProviderListResponse>(
    `/model-providers${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function fetchSupportedModelProviders(): Promise<SupportedModelProvidersResponse> {
  const response = await requestJson<SupportedModelProvidersResponse>('/model-providers/supported');

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createModelProvider(
  payload: ModelProviderPayload
): Promise<ModelProviderResponse> {
  const response = await requestJson<ModelProviderResponse>('/model-providers', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateModelProvider(
  id: string,
  payload: ModelProviderMutationPayload
): Promise<ModelProviderResponse> {
  const response = await requestJson<ModelProviderResponse>(`/model-providers/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteModelProvider(id: string): Promise<ModelDeleteResult> {
  const response = await requestJson<ModelDeleteResult>(`/model-providers/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function fetchProviderModels(
  params: ModelResourceListParams = {}
): Promise<ProviderModelListResponse> {
  const response = await requestJson<ProviderModelListResponse>(
    `/provider-models${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createProviderModel(
  payload: ProviderModelPayload
): Promise<ProviderModelResponse> {
  const response = await requestJson<ProviderModelResponse>('/provider-models', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateProviderModel(
  id: string,
  payload: ProviderModelMutationPayload
): Promise<ProviderModelResponse> {
  const response = await requestJson<ProviderModelResponse>(`/provider-models/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteProviderModel(id: string): Promise<ModelDeleteResult> {
  const response = await requestJson<ModelDeleteResult>(`/provider-models/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function testProviderModelConnection(
  id: string
): Promise<ModelConnectionTestResponse> {
  const response = await requestJson<ModelConnectionTestResponse>(`/provider-models/${id}/test`, {
    method: 'POST'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function fetchModelFallbackGroups(
  params: ModelResourceListParams = {}
): Promise<ModelFallbackGroupListResponse> {
  const response = await requestJson<ModelFallbackGroupListResponse>(
    `/model-fallback-groups${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function createModelFallbackGroup(
  payload: ModelFallbackGroupPayload
): Promise<ModelFallbackGroupResponse> {
  const response = await requestJson<ModelFallbackGroupResponse>('/model-fallback-groups', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function updateModelFallbackGroup(
  id: string,
  payload: ModelFallbackGroupMutationPayload
): Promise<ModelFallbackGroupResponse> {
  const response = await requestJson<ModelFallbackGroupResponse>(`/model-fallback-groups/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function deleteModelFallbackGroup(id: string): Promise<ModelDeleteResult> {
  const response = await requestJson<ModelDeleteResult>(`/model-fallback-groups/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 把列表查询参数拼成 query string。
 *
 * 仅把实际传入的字段写入 URLSearchParams，undefined 的跳过；
 * 无任何字段时返回空字符串（不产生 `?`）。
 */
function toQueryString(params: ModelResourceListParams): string {
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
