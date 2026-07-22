/**
 * Persona API 封装（路由前缀 /personas）。
 *
 * 提供 CRUD 与设为默认；类型主要复用 shared 包。
 */
import { requestJson } from './http';
import type {
  ModuleImportTemplateResponse,
  ModuleImportDuplicateNameStrategy,
  PersonaImportResponse,
  PersonaListResponse,
  PersonaPayload,
  PersonaResponse,
  ContentLibraryScope
} from '@tavern/shared';

/** Persona 数据（shared 类型别名）。 */
export type Persona = PersonaResponse;
/** Persona 更新载荷：在 shared 全量载荷基础上放宽为部分更新。 */
export type PersonaMutationPayload = Partial<PersonaPayload> & {
  name?: string;
};

/** Persona 列表查询参数，所有字段可选。 */
export type PersonaListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 按是否默认过滤。 */
  isDefault?: boolean;
  scope?: ContentLibraryScope;
};

/** 删除 Persona 的结果。 */
export type PersonaDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的 Persona ID。 */
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
 * 查询 Persona 列表。GET /personas
 * @param params 分页与过滤参数。
 * @returns Persona 列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchPersonas(params: PersonaListParams = {}): Promise<PersonaListResponse> {
  const response = await requestJson<PersonaListResponse>(`/personas${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function fetchPersona(id: string): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>(`/personas/${id}`);
  if (!response.success)
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  return response.data;
}

export async function forkPersona(id: string): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>(`/personas/${id}/fork`, { method: 'POST' });
  if (!response.success)
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  return response.data;
}

/**
 * 创建 Persona。POST /personas
 * @param payload Persona 创建载荷。
 * @returns 新建的 Persona。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 导入 Persona JSON。POST /personas/import
 * @param rawJson 原始 JSON 文本。
 * @param options commit=false 为预览，commit=true 才落库。
 * @returns 导入预览或正式导入结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function importPersonaJson(
  rawJson: string,
  options: {
    commit?: boolean;
    duplicateNameStrategy?: ModuleImportDuplicateNameStrategy;
  } = {}
): Promise<PersonaImportResponse<PersonaResponse>> {
  const response = await requestJson<PersonaImportResponse<PersonaResponse>>('/personas/import', {
    method: 'POST',
    body: {
      rawJson,
      commit: options.commit ?? false,
      duplicateNameStrategy: options.duplicateNameStrategy ?? 'reject'
    }
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/** 下载 Persona 导入模板。GET /personas/import-template */
export async function fetchPersonaImportTemplate(): Promise<ModuleImportTemplateResponse> {
  const response = await requestJson<ModuleImportTemplateResponse>('/personas/import-template');

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function exportPersonaJson(
  id: string
): Promise<{ fileName: string; card: Record<string, unknown> }> {
  const response = await requestJson<{ fileName: string; card: Record<string, unknown> }>(
    `/personas/${id}/export`
  );
  if (!response.success)
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  return response.data;
}

/**
 * 更新 Persona。PUT /personas/:id
 * @param id Persona ID。
 * @param payload Persona 更新载荷（部分更新）。
 * @returns 更新后的 Persona。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 删除 Persona。DELETE /personas/:id
 * @param id Persona ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deletePersona(id: string): Promise<PersonaDeleteResult> {
  const response = await requestJson<PersonaDeleteResult>(`/personas/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 将指定 Persona 设为默认。POST /personas/:id/set-default
 *
 * 后端会自动取消其余 Persona 的默认标记，保证全局唯一默认。
 * @param id Persona ID。
 * @returns 设为默认后的 Persona。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function setDefaultPersona(id: string): Promise<PersonaResponse> {
  const response = await requestJson<PersonaResponse>(`/personas/${id}/set-default`, {
    method: 'POST'
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
  if (params.scope) query.set('scope', params.scope);

  const value = query.toString();

  return value ? `?${value}` : '';
}
