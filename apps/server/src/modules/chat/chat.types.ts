import type {
  Character,
  Conversation,
  ModelFallbackGroup,
  ModelConfig,
  PromptPreset,
  UserPersona
} from '@prisma/client';

/** 聊天会话（含关联的角色/模型配置/预设/人设）。 */
export type ChatConversation = Conversation & {
  character: Character;
  modelFallbackGroup: ModelFallbackGroup | null;
  modelConfig: ModelConfig | null;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

/** SSE 事件名：delta 增量 / done 完成 / error 错误。 */
export type ChatSseEventName = 'delta' | 'done' | 'error';

/** SSE 事件载荷（任意键值对象）。 */
export type ChatSseEventPayload = Record<string, unknown>;

/** 进行中的聊天任务（用于会话级并发控制）。 */
export type ChatTask = {
  conversationId: string;
  /** 正在生成的 assistant 消息 ID，未开始时为 null。 */
  assistantMessageId: string | null;
  /** 中断控制器，客户端断开时用于中止模型请求。 */
  abortController: AbortController;
};

/** 聊天消息的扩展元数据（记录来源、重生成关系、错误等）。 */
export type ChatMessageMetadata = {
  source?: 'chat-stream';
  /** 触发本次生成的用户消息 ID。 */
  requestMessageId?: string;
  /** 本消息是哪条消息的重新生成。 */
  regenerateOfMessageId?: string;
  /** 本消息被哪条新消息重新生成（原消息标记用）。 */
  regeneratedAt?: string;
  regeneratedByMessageId?: string;
  error?: {
    code: string;
    message: string;
  };
  modelFallback?: {
    groupId: string | null;
    selectedModelId: string | null;
    attempts: Array<{
      providerName: string;
      modelName: string;
      status: 'failed' | 'succeeded';
      reason?: string;
    }>;
  };
  /** 是否被客户端中断。 */
  aborted?: boolean;
  /** 是否被主动停止。 */
  stopped?: boolean;
};

/** Express 响应对象的最小形状（SSE 流式写入用）。 */
export type ChatResponseLike = {
  writableEnded: boolean;
  destroyed?: boolean;
  status(code: number): ChatResponseLike;
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  end(): void;
  on(event: 'close', listener: () => void): void;
  off(event: 'close', listener: () => void): void;
};
