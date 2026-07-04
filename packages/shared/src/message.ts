import type { PageResult } from './pagination';

/** 消息角色，对应 OpenAI Chat Completions 的 role 取值。 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 消息状态，覆盖一条消息从生成到最终态的全生命周期：
 * - `complete` 生成完成；
 * - `edited` 用户手动编辑过；
 * - `deleted` 已删除（软删除）；
 * - `generating` 正在流式生成中；
 * - `failed` 生成失败；
 * - `stopped` 被手动中止。
 */
export type MessageStatus = 'complete' | 'edited' | 'deleted' | 'generating' | 'failed' | 'stopped';

/** 单条消息的响应体。 */
export type MessageResponse = {
  /** 消息 ID。 */
  id: string;
  /** 所属会话 ID。 */
  conversationId: string;
  /** 消息角色（标准 role 之外的字符串视为自定义角色）。 */
  role: MessageRole | string;
  /** 消息正文。 */
  content: string;
  /** 消息状态（标准 status 之外的字符串视为自定义状态）。 */
  status: MessageStatus | string;
  /** 附加元数据，如 token 统计、生成参数等；无则为 null。 */
  metadata: Record<string, unknown> | null;
  /** 消息 token 数估算；未统计时为 null。 */
  tokenCount: number | null;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 消息列表分页响应。 */
export type MessageListResponse = PageResult<MessageResponse>;

/**
 * 更新消息的入参，所有字段可选（部分更新）。
 *
 * `status` 只允许切到终态或中间态集合（complete/edited/failed/stopped）。
 */
export type MessageUpdatePayload = {
  /** 新的消息正文。 */
  content?: string;
  /** 新状态，限定为可手动设置的子集。 */
  status?: Extract<MessageStatus, 'complete' | 'edited' | 'failed' | 'stopped'>;
  /** 新的元数据，传 null 清空。 */
  metadata?: Record<string, unknown> | null;
  /** 新的 token 数估算，传 null 表示未统计。 */
  tokenCount?: number | null;
};

/**
 * 重新生成消息的响应。
 *
 * 后端不会直接返回新生成的文本，而是返回一个指向 SSE 流端点的指引，
 * 前端据此发起 `/chat/stream` 请求拉取真正的生成内容。
 */
export type MessageRegenerateResponse = {
  /** 被重新生成的目标消息所属的会话 ID。 */
  id: string;
  /** 会话 ID（与 id 同值，保留以便前端统一解构）。 */
  conversationId: string;
  /** 被重新生成的目标 assistant 消息 ID。 */
  regenerateMessageId: string;
  /** 替换策略：软删除原消息后生成新的，不物理删除历史。 */
  replaceStrategy: 'soft-delete-target';
  /** 实际拉取生成内容的 SSE 流端点。 */
  streamPath: '/chat/stream';
  /** 给人看的说明。 */
  message: string;
};
