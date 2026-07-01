import { defineStore } from 'pinia';

import { fetchConversationMessages, type Message, type MessageListParams } from '../api/messages';

let localMessageSeed = 0;

type ChatState = {
  conversationId: string | null;
  messages: Message[];
  pendingUserMessage: Message | null;
  streamingMessage: Message | null;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  sendError: string | null;
  draft: string;
  sending: boolean;
  isStreaming: boolean;
  stopping: boolean;
  currentStreamTaskId: string | null;
  regeneratingMessageId: string | null;
};

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    conversationId: null,
    messages: [],
    pendingUserMessage: null,
    streamingMessage: null,
    total: 0,
    page: 1,
    pageSize: 100,
    loading: false,
    error: null,
    sendError: null,
    draft: '',
    sending: false,
    isStreaming: false,
    stopping: false,
    currentStreamTaskId: null,
    regeneratingMessageId: null
  }),
  getters: {
    visibleMessages: (state): Message[] => [
      ...state.messages.filter((message) => message.id !== state.regeneratingMessageId),
      ...(state.pendingUserMessage ? [state.pendingUserMessage] : []),
      ...(state.streamingMessage ? [state.streamingMessage] : [])
    ],
    hasMessages: (state) =>
      state.messages.length > 0 ||
      Boolean(state.pendingUserMessage) ||
      Boolean(state.streamingMessage),
    isGenerating: (state) => state.sending || state.isStreaming || state.stopping,
    canStop: (state) =>
      Boolean(state.currentStreamTaskId) && (state.sending || state.isStreaming) && !state.stopping
  },
  actions: {
    setDraft(value: string) {
      this.draft = value;
    },
    reset() {
      this.conversationId = null;
      this.messages = [];
      this.total = 0;
      this.page = 1;
      this.error = null;
      this.sendError = null;
      this.draft = '';
      this.pendingUserMessage = null;
      this.streamingMessage = null;
      this.sending = false;
      this.isStreaming = false;
      this.stopping = false;
      this.currentStreamTaskId = null;
      this.regeneratingMessageId = null;
    },
    beginStreaming(conversationId: string, userMessage: string) {
      const content = userMessage.trim();
      const createdAt = new Date().toISOString();
      const taskId = createLocalId('stream');

      this.conversationId = conversationId;
      this.currentStreamTaskId = taskId;
      this.regeneratingMessageId = null;
      this.pendingUserMessage = createLocalMessage({
        conversationId,
        role: 'user',
        content,
        status: 'complete',
        createdAt
      });
      this.streamingMessage = createLocalMessage({
        conversationId,
        role: 'assistant',
        content: '',
        status: 'generating',
        createdAt
      });
      this.sendError = null;
      this.draft = '';
      this.sending = true;
      this.isStreaming = true;
      this.stopping = false;
    },
    beginRegenerateStreaming(conversationId: string, targetMessage: Message) {
      const createdAt = new Date().toISOString();
      const taskId = createLocalId('regenerate');

      this.conversationId = conversationId;
      this.currentStreamTaskId = taskId;
      this.regeneratingMessageId = targetMessage.id;
      this.pendingUserMessage = null;
      this.streamingMessage = createLocalMessage({
        conversationId,
        role: 'assistant',
        content: '',
        status: 'generating',
        createdAt
      });
      this.sendError = null;
      this.sending = true;
      this.isStreaming = true;
      this.stopping = false;
    },
    appendStreamingDelta(delta: { text: string; messageId?: string }) {
      if (!this.streamingMessage || this.stopping) {
        return;
      }

      this.streamingMessage = {
        ...this.streamingMessage,
        id: delta.messageId || this.streamingMessage.id,
        content: `${this.streamingMessage.content}${delta.text}`,
        updatedAt: new Date().toISOString()
      };
      this.sending = false;
      this.isStreaming = true;
    },
    completeStreaming(messageId?: string) {
      if (this.streamingMessage) {
        this.streamingMessage = {
          ...this.streamingMessage,
          id: messageId || this.streamingMessage.id,
          status: 'complete',
          updatedAt: new Date().toISOString()
        };
      }

      this.sending = false;
      this.isStreaming = false;
      this.stopping = false;
      this.currentStreamTaskId = null;
      this.regeneratingMessageId = null;
    },
    failStreaming(message: string) {
      this.sendError = message;

      if (this.streamingMessage) {
        this.streamingMessage = {
          ...this.streamingMessage,
          status: 'failed',
          metadata: {
            ...(this.streamingMessage.metadata ?? {}),
            error: {
              message
            }
          },
          updatedAt: new Date().toISOString()
        };
      }

      this.sending = false;
      this.isStreaming = false;
      this.stopping = false;
      this.currentStreamTaskId = null;
      this.regeneratingMessageId = null;
    },
    requestStopStreaming() {
      if (!this.currentStreamTaskId || this.stopping) {
        return false;
      }

      this.stopping = true;
      this.sending = false;

      if (this.streamingMessage) {
        this.streamingMessage = {
          ...this.streamingMessage,
          status: 'stopped',
          metadata: {
            ...(this.streamingMessage.metadata ?? {}),
            aborted: true
          },
          updatedAt: new Date().toISOString()
        };
      }

      return true;
    },
    stopStreaming(message: string) {
      if (this.streamingMessage) {
        this.streamingMessage = {
          ...this.streamingMessage,
          status: 'stopped',
          metadata: {
            ...(this.streamingMessage.metadata ?? {}),
            aborted: true,
            error: {
              message
            }
          },
          updatedAt: new Date().toISOString()
        };
      }

      this.sendError = null;
      this.sending = false;
      this.isStreaming = false;
      this.stopping = false;
      this.currentStreamTaskId = null;
      this.regeneratingMessageId = null;
    },
    clearStreamingMessages() {
      this.pendingUserMessage = null;
      this.streamingMessage = null;
      this.sending = false;
      this.isStreaming = false;
      this.stopping = false;
      this.currentStreamTaskId = null;
      this.regeneratingMessageId = null;
    },
    async loadMessages(conversationId: string, params: MessageListParams = {}) {
      this.conversationId = conversationId;
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? this.pageSize;
        const result = await fetchConversationMessages(conversationId, {
          ...params,
          page,
          pageSize,
          order: params.order ?? 'asc'
        });

        if (this.conversationId !== conversationId) {
          return;
        }

        this.messages = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
      } catch (error) {
        if (this.conversationId !== conversationId) {
          return;
        }

        this.error = error instanceof Error ? error.message : '消息列表加载失败。';
        this.messages = [];
        this.total = 0;
      } finally {
        if (this.conversationId === conversationId) {
          this.loading = false;
        }
      }
    }
  }
});

function createLocalMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: Message['status'];
  createdAt: string;
}): Message {
  return {
    id: createLocalId(params.role),
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    status: params.status,
    metadata: {
      local: true
    },
    tokenCount: null,
    createdAt: params.createdAt,
    updatedAt: params.createdAt
  };
}

function createLocalId(prefix: string): string {
  localMessageSeed += 1;

  return `local-${prefix}-${Date.now()}-${localMessageSeed}`;
}
