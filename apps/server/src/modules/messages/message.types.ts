/** 消息角色：system 系统指令 / user 用户 / assistant 角色 / tool 工具调用。 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 消息状态。 */
export type MessageStatus =
  | 'complete' // 生成完成
  | 'edited' // 已被用户编辑
  | 'deleted' // 已删除
  | 'generating' // 生成中
  | 'failed' // 生成失败
  | 'stopped'; // 已停止

/** 消息对外响应。 */
export type MessageResponse = {
  id: string;
  conversationId: string;
  turnId: string | null;
  role: MessageRole | string;
  content: string;
  status: MessageStatus | string;
  metadata: Record<string, unknown> | null;
  /** token 数（用于计费/上下文统计），可能为 null。 */
  tokenCount: number | null;
  createdAt: string;
  updatedAt: string;
};

/** 消息列表分页响应。 */
export type MessageListResponse = {
  items: MessageResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/** 重新生成消息的响应：返回提示让前端调用 /chat/stream 实际重生成。 */
export type MessageRegenerateResponse = {
  id: string;
  conversationId: string;
  regenerateMessageId: string;
  turnId: string;
  /** 替换策略：软删除目标消息后重新生成。 */
  replaceStrategy: 'switch-active-on-success';
  /** 实际执行重生成的接口路径。 */
  streamPath: '/chat/stream';
  message: string;
};
