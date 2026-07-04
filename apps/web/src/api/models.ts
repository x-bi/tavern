/**
 * 模型配置 API 封装（路由前缀 /model-configs）。
 *
 * 提供 CRUD 与连通性测试；类型主要复用 shared 包。
 */
import { requestJson } from './http';
import type {
  ModelConfigListResponse,
  ModelConfigPayload,
  ModelConfigResponse,
  ModelConfigTestResponse
} from '@tavern/shared';

/** 模型配置数据（shared 类型别名）。 */
export type ModelConfig = ModelConfigResponse;
/**
 * 模型配置更新载荷：在 shared 全量载荷基础上放宽为部分更新，
 * 并允许 name 等核心字段可选（编辑场景可能只改部分字段）。
 */
export type ModelConfigMutationPayload = Partial<ModelConfigPayload> & {
  name?: string;
  providerName?: string;
  baseUrl?: string;
  modelName?: string;
};

/** 模型配置列表查询参数，所有字段可选。 */
export type ModelConfigListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 按启用状态过滤。 */
  isEnabled?: boolean;
};

/** 删除模型配置的结果。 */
export type ModelConfigDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的模型配置 ID。 */
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

/**
 * 查询模型配置列表。GET /model-configs
 * @param params 分页与过滤参数。
 * @returns 模型配置列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 创建模型配置。POST /model-configs
 * @param payload 模型配置创建载荷。
 * @returns 新建的模型配置。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 更新模型配置。PUT /model-configs/:id
 * @param id 模型配置 ID。
 * @param payload 模型配置更新载荷（部分更新）。
 * @returns 更新后的模型配置。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 删除模型配置。DELETE /model-configs/:id
 * @param id 模型配置 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 测试模型配置连通性。POST /model-configs/:id/test
 * @param id 模型配置 ID。
 * @returns 连通性测试结果（含往返耗时与状态码）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 把列表查询参数拼成 query string。
 *
 * 仅把实际传入的字段写入 URLSearchParams，undefined 的跳过；
 * 无任何字段时返回空字符串（不产生 `?`）。
 */
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
