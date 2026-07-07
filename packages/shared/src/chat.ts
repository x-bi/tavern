/**
 * 聊天流式请求入参（POST /chat/stream）。
 *
 * `userMessage` 与 `regenerateMessageId` 二选一：
 * - 发新消息时传 `userMessage`；
 * - 重新生成某条 assistant 消息时传 `regenerateMessageId`，不传 `userMessage`。
 */
export type ChatStreamPayload = {
  /** 会话 ID。 */
  conversationId: string;
  /** 用户输入的明文消息；重新生成时不传。 */
  userMessage?: string;
  /** 要重新生成的 assistant 消息 ID；发新消息时不传。 */
  regenerateMessageId?: string;
  /** 本次会话覆盖使用的模型链 ID；未传时用会话绑定的模型链。 */
  modelFallbackGroupId?: string | null;
  /** 本次会话覆盖使用的 Prompt 预设 ID；未传时用会话绑定的预设。 */
  presetId?: string | null;
  /** 历史消息最多取多少条进入 Prompt；未传由后端按预设截断。 */
  historyLimit?: number;
  /** 历史消息总字符数上限，超出会从最旧开始截断。 */
  maxHistoryCharacters?: number;
};

/** 聊天候选用户发言请求入参（POST /chat/suggestions）。 */
export type ChatSuggestionPayload = Omit<
  ChatStreamPayload,
  'userMessage' | 'regenerateMessageId'
> & {
  /** 希望生成的候选条数，默认 3。 */
  count?: number;
};

/** 单条候选用户发言。 */
export type ChatSuggestion = {
  /** 前端展示和选择用的稳定序号。 */
  id: string;
  /** 可直接放入聊天输入框的文本。 */
  text: string;
};

/** 聊天候选用户发言响应。 */
export type ChatSuggestionResult = {
  /** 候选用户发言列表。 */
  suggestions: ChatSuggestion[];
};

/** SSE 增量帧：模型生成的一个文本片段。 */
export type ChatStreamDeltaEvent = {
  /** 本次增量的文本片段。 */
  text: string;
  /** 正在生成的 assistant 消息 ID（前端据此关联同一条消息）。 */
  messageId: string;
};

/** SSE 结束帧：流正常结束。 */
export type ChatStreamDoneEvent = {
  /** 本次生成的 assistant 消息 ID。 */
  messageId: string;
  /** 结束原因（如 `stop`、`length`）；流被中断或异常时为 null。 */
  finishReason: string | null;
};

/** SSE 错误帧：流异常中断。 */
export type ChatStreamErrorEvent = {
  /** 业务错误码（见后端 ERROR_CODES），如 `MODEL_ERROR`、`CHAT_STREAM_ABORTED`。 */
  code: string;
  /** 给人看的错误描述。 */
  message: string;
};
