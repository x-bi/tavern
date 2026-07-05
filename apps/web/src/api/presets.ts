/**
 * Prompt 预设 API 封装（路由前缀 /prompt-presets）。
 *
 * 提供 CRUD；类型主要复用 shared 包。
 */
import { requestJson } from './http';
import type {
  ModuleImportDuplicateNameStrategy,
  PromptPresetImportResponse,
  PromptPresetListResponse,
  PromptPresetPayload,
  PromptPresetResponse
} from '@tavern/shared';

/** Prompt 预设数据（shared 类型别名）。 */
export type PromptPreset = PromptPresetResponse;
/** 预设更新载荷：在 shared 全量载荷基础上放宽为部分更新。 */
export type PromptPresetMutationPayload = Partial<PromptPresetPayload> & {
  name?: string;
};

/** 预设列表查询参数，所有字段可选。 */
export type PromptPresetListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 按是否默认过滤。 */
  isDefault?: boolean;
};

/** 删除预设的结果。 */
export type PromptPresetDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的预设 ID。 */
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
 * 查询预设列表。GET /prompt-presets
 * @param params 分页与过滤参数。
 * @returns 预设列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 创建预设。POST /prompt-presets
 * @param payload 预设创建载荷。
 * @returns 新建的预设。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 导入 Prompt 预设 JSON。POST /prompt-presets/import
 * @param rawJson 原始 JSON 文本。
 * @param options commit=false 为预览，commit=true 才落库。
 * @returns 导入预览或正式导入结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function importPromptPresetJson(
  rawJson: string,
  options: {
    commit?: boolean;
    duplicateNameStrategy?: ModuleImportDuplicateNameStrategy;
  } = {}
): Promise<PromptPresetImportResponse<PromptPresetResponse>> {
  const response = await requestJson<PromptPresetImportResponse<PromptPresetResponse>>(
    '/prompt-presets/import',
    {
      method: 'POST',
      body: {
        rawJson,
        commit: options.commit ?? false,
        duplicateNameStrategy: options.duplicateNameStrategy ?? 'reject'
      }
    }
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 更新预设。PUT /prompt-presets/:id
 * @param id 预设 ID。
 * @param payload 预设更新载荷（部分更新）。
 * @returns 更新后的预设。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 删除预设。DELETE /prompt-presets/:id
 * @param id 预设 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deletePromptPreset(id: string): Promise<PromptPresetDeleteResult> {
  const response = await requestJson<PromptPresetDeleteResult>(`/prompt-presets/${id}`, {
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
