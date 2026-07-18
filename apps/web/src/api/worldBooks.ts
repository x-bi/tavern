/**
 * 世界书 API 封装。
 *
 * 世界书本体走 /world-books；条目创建走嵌套路由 POST /world-books/:id/entries，
 * 而条目的更新 / 删除走独立的 /world-book-entries/:id（非嵌套）。
 */
import { requestJson } from './http';
import type {
  ModuleImportDuplicateNameStrategy,
  ModuleImportTemplateResponse,
  WorldBookEntryPayload,
  WorldBookEntryResponse,
  WorldBookEntryUpdatePayload,
  WorldBookImportResponse,
  WorldBookListResponse,
  WorldBookPayload,
  WorldBookResponse,
  WorldBookUpdatePayload,
  ContentLibraryScope
} from '@tavern/shared';

/** 世界书数据（shared 类型别名）。 */
export type WorldBook = WorldBookResponse;
/** 世界书条目数据（shared 类型别名）。 */
export type WorldBookEntry = WorldBookEntryResponse;
/** 世界书更新载荷：在 shared 部分更新载荷上补 name。 */
export type WorldBookMutationPayload = WorldBookUpdatePayload & {
  name?: string;
};
/** 世界书条目更新载荷（shared 类型别名）。 */
export type WorldBookEntryMutationPayload = WorldBookEntryUpdatePayload;

/** 世界书列表查询参数，所有字段可选。 */
export type WorldBookListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 按角色过滤。 */
  characterId?: string;
  /** 按启用状态过滤。 */
  isEnabled?: boolean;
  scope?: ContentLibraryScope;
};

/** 删除世界书或条目的结果。 */
export type WorldBookDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的 ID。 */
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
 * 查询世界书列表。GET /world-books
 * @param params 分页与过滤参数。
 * @returns 世界书列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchWorldBooks(
  params: WorldBookListParams = {}
): Promise<WorldBookListResponse> {
  const response = await requestJson<WorldBookListResponse>(`/world-books${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 获取单本世界书（含全部条目）。GET /world-books/:id
 * @param id 世界书 ID。
 * @returns 世界书完整数据。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchWorldBook(id: string): Promise<WorldBookResponse> {
  const response = await requestJson<WorldBookResponse>(`/world-books/${id}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function forkWorldBook(
  id: string,
  targetCharacterId?: string
): Promise<WorldBookResponse> {
  const response = await requestJson<WorldBookResponse>(`/world-books/${id}/fork`, {
    method: 'POST',
    body: targetCharacterId ? { targetCharacterId } : {}
  });
  if (!response.success)
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  return response.data;
}

/**
 * 创建世界书。POST /world-books
 * @param payload 世界书创建载荷。
 * @returns 新建的世界书。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 导入世界书 JSON。POST /world-books/import
 * @param rawJson 原始 JSON 文本。
 * @param options commit=false 为预览，commit=true 才落库。
 * @returns 导入预览或正式导入结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function importWorldBookJson(
  rawJson: string,
  options: {
    commit?: boolean;
    duplicateNameStrategy?: ModuleImportDuplicateNameStrategy;
  } = {}
): Promise<WorldBookImportResponse<WorldBookResponse>> {
  const response = await requestJson<WorldBookImportResponse<WorldBookResponse>>(
    '/world-books/import',
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

/** 下载世界书导入模板。GET /world-books/import-template */
export async function fetchWorldBookImportTemplate(): Promise<ModuleImportTemplateResponse> {
  const response = await requestJson<ModuleImportTemplateResponse>('/world-books/import-template');

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 更新世界书。PUT /world-books/:id
 * @param id 世界书 ID。
 * @param payload 世界书更新载荷（部分更新）。
 * @returns 更新后的世界书。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 删除世界书。DELETE /world-books/:id
 * @param id 世界书 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deleteWorldBook(id: string): Promise<WorldBookDeleteResult> {
  const response = await requestJson<WorldBookDeleteResult>(`/world-books/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 在指定世界书下创建条目。POST /world-books/:worldBookId/entries
 * @param worldBookId 所属世界书 ID。
 * @param payload 条目创建载荷。
 * @returns 新建的条目。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 更新条目。PUT /world-book-entries/:id
 *
 * 注意：条目更新走独立路由 /world-book-entries（非嵌套在世界书下）。
 * @param id 条目 ID。
 * @param payload 条目更新载荷（部分更新）。
 * @returns 更新后的条目。
 * @throws ApiClientError 后端返回失败时抛出。
 */
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

/**
 * 删除条目。DELETE /world-book-entries/:id
 * @param id 条目 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deleteWorldBookEntry(id: string): Promise<WorldBookDeleteResult> {
  const response = await requestJson<WorldBookDeleteResult>(`/world-book-entries/${id}`, {
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
  if (params.scope) query.set('scope', params.scope);

  const value = query.toString();

  return value ? `?${value}` : '';
}
