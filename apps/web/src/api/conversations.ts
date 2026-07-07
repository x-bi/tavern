/**
 * 会话 API 封装（路由前缀 /conversations）。
 *
 * 类型主要复用 shared 包（ConversationResponse 等），本文件定义查询参数与结果类型。
 */
import { requestJson } from './http';
import type {
  ConversationClearResponse,
  ConversationListResponse,
  ConversationPayload,
  ConversationResponse,
  ConversationUpdatePayload
} from '@tavern/shared';

/** 会话数据（shared 类型别名）。 */
export type Conversation = ConversationResponse;
/** 会话更新载荷（shared 类型别名）。 */
export type ConversationMutationPayload = ConversationUpdatePayload;

/** 会话列表查询参数，所有字段可选。 */
export type ConversationListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 标题搜索关键字。 */
  search?: string;
  /** 按角色过滤。 */
  characterId?: string;
  /** 按 Prompt 预设过滤。 */
  promptPresetId?: string;
  /** 按 Persona 过滤。 */
  personaId?: string;
  /** 按状态过滤。 */
  status?: string;
};

/** 删除会话的结果。 */
export type ConversationDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的会话 ID。 */
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
 * 查询会话列表。GET /conversations
 * @param params 分页与过滤参数。
 * @returns 会话列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchConversations(
  params: ConversationListParams = {}
): Promise<ConversationListResponse> {
  const response = await requestJson<ConversationListResponse>(
    `/conversations${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 创建会话。POST /conversations
 * @param payload 会话创建载荷。
 * @returns 新建的会话。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function createConversation(
  payload: ConversationPayload
): Promise<ConversationResponse> {
  const response = await requestJson<ConversationResponse>('/conversations', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 更新会话。PUT /conversations/:id
 * @param id 会话 ID。
 * @param payload 会话更新载荷（部分更新）。
 * @returns 更新后的会话。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function updateConversation(
  id: string,
  payload: ConversationMutationPayload
): Promise<ConversationResponse> {
  const response = await requestJson<ConversationResponse>(`/conversations/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 删除会话。DELETE /conversations/:id
 * @param id 会话 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deleteConversation(id: string): Promise<ConversationDeleteResult> {
  const response = await requestJson<ConversationDeleteResult>(`/conversations/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 清空会话消息（软删除）。POST /conversations/:id/clear
 * @param id 会话 ID。
 * @returns 清空结果（含被删除的消息条数）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function clearConversation(id: string): Promise<ConversationClearResponse> {
  const response = await requestJson<ConversationClearResponse>(`/conversations/${id}/clear`, {
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
function toQueryString(params: ConversationListParams): string {
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

  if (params.promptPresetId) {
    query.set('promptPresetId', params.promptPresetId);
  }

  if (params.personaId) {
    query.set('personaId', params.personaId);
  }

  if (params.status) {
    query.set('status', params.status);
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
