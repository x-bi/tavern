/**
 * 消息 API 封装。
 *
 * 列表接口挂在会话下（GET /conversations/:id/messages），
 * 单条操作走 /messages/:id（更新、删除、重新生成）。
 */
import { requestJson } from './http';
import type {
  MessageListResponse,
  MessageRegenerateResponse,
  MessageResponse,
  MessageRole,
  MessageStatus,
  MessageUpdatePayload
} from '@tavern/shared';

/** 消息数据（shared 类型别名）。 */
export type Message = MessageResponse;
/** 消息更新载荷（shared 类型别名）。 */
export type MessageMutationPayload = MessageUpdatePayload;

/** 消息列表查询参数，所有字段可选。 */
export type MessageListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 排序方向。 */
  order?: 'asc' | 'desc';
  /** 按角色过滤。 */
  role?: MessageRole;
  /** 按状态过滤。 */
  status?: MessageStatus | string;
  /** 正文搜索关键字。 */
  search?: string;
};

/** 删除消息的结果。 */
export type MessageDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的消息 ID。 */
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
 * 查询会话的消息列表。GET /conversations/:conversationId/messages
 * @param conversationId 会话 ID。
 * @param params 分页与过滤参数。
 * @returns 消息列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchConversationMessages(
  conversationId: string,
  params: MessageListParams = {}
): Promise<MessageListResponse> {
  const response = await requestJson<MessageListResponse>(
    `/conversations/${conversationId}/messages${toQueryString(params)}`
  );

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 更新消息（如编辑正文、改状态）。PUT /messages/:id
 * @param id 消息 ID。
 * @param payload 消息更新载荷（部分更新）。
 * @returns 更新后的消息。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function updateMessage(
  id: string,
  payload: MessageMutationPayload
): Promise<MessageResponse> {
  const response = await requestJson<MessageResponse>(`/messages/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 删除消息。DELETE /messages/:id
 * @param id 消息 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deleteMessage(id: string): Promise<MessageDeleteResult> {
  const response = await requestJson<MessageDeleteResult>(`/messages/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 重新生成某条 assistant 消息。POST /messages/:id/regenerate
 *
 * 后端不直接返回生成内容，而是返回指向 SSE 流的指引，
 * 调用方据此发起 /chat/stream 拉取真正生成结果。
 * @param id 要重新生成的目标消息 ID。
 * @returns 重新生成指引（含 streamPath）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function regenerateMessage(id: string): Promise<MessageRegenerateResponse> {
  const response = await requestJson<MessageRegenerateResponse>(`/messages/${id}/regenerate`, {
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
function toQueryString(params: MessageListParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params.order !== undefined) {
    query.set('order', params.order);
  }

  if (params.role) {
    query.set('role', params.role);
  }

  if (params.status) {
    query.set('status', params.status);
  }

  if (params.search) {
    query.set('search', params.search);
  }

  const value = query.toString();

  return value ? `?${value}` : '';
}
