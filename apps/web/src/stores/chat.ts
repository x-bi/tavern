import { defineStore } from 'pinia';
import {
  createClientOperationId,
  type ChatSuggestion,
  type ChatSuggestionPayload,
  type SceneImage
} from '@tavern/shared';

import { fetchChatSuggestions } from '../api/chat';
import {
  deleteMessage,
  fetchConversationMessages,
  updateMessage,
  type Message,
  type MessageListParams
} from '../api/messages';
import {
  createMessageImageGeneration,
  fetchConversationMessageImages,
  fetchImageGenerationBatch,
  fetchRunningImageBatches,
  regenerateImageBatch
} from '../api/images';

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
  mutatingMessageIds: string[];
  operationError: string | null;
  suggestions: ChatSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  messageImages: Record<string, SceneImage[]>;
  imageGeneratingMessageIds: string[];
  imageGenerationErrors: Record<string, string>;
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
    regeneratingMessageId: null,
    mutatingMessageIds: [],
    operationError: null,
    suggestions: [],
    suggestionsLoading: false,
    suggestionsError: null,
    messageImages: {},
    imageGeneratingMessageIds: [],
    imageGenerationErrors: {}
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
      this.mutatingMessageIds = [];
      this.operationError = null;
      this.suggestions = [];
      this.suggestionsLoading = false;
      this.suggestionsError = null;
      this.messageImages = {};
      this.imageGeneratingMessageIds = [];
      this.imageGenerationErrors = {};
    },
    clearSuggestions() {
      this.suggestions = [];
      this.suggestionsError = null;
    },
    applySuggestion(text: string) {
      this.draft = text;
      this.clearSuggestions();
    },
    async loadSuggestions(payload: ChatSuggestionPayload) {
      if (this.isGenerating || this.suggestionsLoading) {
        return;
      }

      this.suggestionsLoading = true;
      this.suggestionsError = null;

      try {
        const result = await fetchChatSuggestions(payload);
        this.suggestions = result.suggestions;
      } catch (error) {
        const message = error instanceof Error ? error.message : '生成候选发言失败。';
        this.suggestionsError = message;
        this.suggestions = [];
        throw new Error(message);
      } finally {
        this.suggestionsLoading = false;
      }
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
      this.clearSuggestions();
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
    async loadMessages(
      conversationId: string,
      params: MessageListParams = {},
      options?: { silent?: boolean }
    ) {
      // silent：静默刷新——不切换 loading，避免 ChatRoom 因 v-if="loading" 卸载整个消息列表、
      // 重置 scrollTop（这正是“生成后回到第一条”的根因）；失败时保留现有消息不清空。
      // 用于流式结束后 / 事件触发的隐式刷新。首次加载与按钮刷新仍走非静默。
      const silent = options?.silent ?? false;
      this.conversationId = conversationId;

      if (!silent) {
        this.loading = true;
        this.error = null;
      }

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

        if (!silent) {
          this.error = error instanceof Error ? error.message : '消息列表加载失败。';
          this.messages = [];
          this.total = 0;
        }
        // 静默刷新失败：保留现有消息，不打断滚动位置
      } finally {
        if (this.conversationId === conversationId && !silent) {
          this.loading = false;
        }
      }
    },
    async loadMessageImages(conversationId: string) {
      const groups = await fetchConversationMessageImages(conversationId);
      if (this.conversationId !== conversationId) return;
      this.messageImages = Object.fromEntries(
        groups.map((group) => [group.messageId, group.images])
      );
    },
    async recoverImageGenerations(conversationId: string) {
      const batches = await fetchRunningImageBatches(conversationId);
      for (const batch of batches) {
        if (!batch.sourceMessageId) continue;
        this.markImageGenerating(batch.sourceMessageId);
        void this.pollImageBatch(batch.id, batch.sourceMessageId);
      }
    },
    async generateSceneImage(messageId: string) {
      this.markImageGenerating(messageId);
      delete this.imageGenerationErrors[messageId];
      try {
        const batch = await createMessageImageGeneration(messageId, {
          requestId: createClientOperationId()
        });
        await this.pollImageBatch(batch.id, messageId);
      } catch (error) {
        this.imageGenerationErrors[messageId] =
          error instanceof Error ? error.message : '场景图片生成失败。';
        this.unmarkImageGenerating(messageId);
        throw error;
      }
    },
    async regenerateSceneImage(messageId: string) {
      const parentBatchId = this.messageImages[messageId]?.[0]?.batchId;
      if (!parentBatchId) return this.generateSceneImage(messageId);
      this.markImageGenerating(messageId);
      delete this.imageGenerationErrors[messageId];
      try {
        const batch = await regenerateImageBatch(parentBatchId, {
          requestId: createClientOperationId()
        });
        await this.pollImageBatch(batch.id, messageId);
      } catch (error) {
        this.imageGenerationErrors[messageId] =
          error instanceof Error ? error.message : '图片重新生成失败。';
        this.unmarkImageGenerating(messageId);
        throw error;
      }
    },
    async pollImageBatch(batchId: string, messageId: string) {
      const terminal = new Set(['succeeded', 'partially_succeeded', 'failed', 'cancelled']);
      try {
        for (;;) {
          const batch = await fetchImageGenerationBatch(batchId);
          if (terminal.has(batch.status)) {
            if (batch.status === 'failed' || batch.status === 'cancelled') {
              this.imageGenerationErrors[messageId] = batch.errorMessage ?? '场景图片生成失败。';
            }
            if (this.conversationId) await this.loadMessageImages(this.conversationId);
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      } finally {
        this.unmarkImageGenerating(messageId);
      }
    },
    markImageGenerating(messageId: string) {
      if (!this.imageGeneratingMessageIds.includes(messageId)) {
        this.imageGeneratingMessageIds = [...this.imageGeneratingMessageIds, messageId];
      }
    },
    unmarkImageGenerating(messageId: string) {
      this.imageGeneratingMessageIds = this.imageGeneratingMessageIds.filter(
        (id) => id !== messageId
      );
    },
    async editMessage(id: string, content: string) {
      const nextContent = content.trim();

      if (!nextContent) {
        throw new Error('消息内容不能为空。');
      }

      this.markMessageMutating(id);
      this.operationError = null;

      try {
        const updated = await updateMessage(id, { content: nextContent });
        this.messages = this.messages.map((message) => (message.id === id ? updated : message));
        if (updated.role === 'user' && updated.turnId) {
          const assistant = this.messages.find(
            (message) => message.turnId === updated.turnId && message.role === 'assistant'
          );
          if (assistant) delete this.messageImages[assistant.id];
        }

        if (this.streamingMessage?.id === id) {
          this.streamingMessage = updated;
        }

        if (this.pendingUserMessage?.id === id) {
          this.pendingUserMessage = updated;
        }

        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : '消息保存失败。';
        this.operationError = message;
        throw new Error(message);
      } finally {
        this.unmarkMessageMutating(id);
      }
    },
    async removeMessage(id: string) {
      this.markMessageMutating(id);
      this.operationError = null;

      try {
        await deleteMessage(id);
        const beforeCount = this.messages.length;
        const removedPending = this.pendingUserMessage?.id === id;
        const removedStreaming = this.streamingMessage?.id === id;
        this.messages = this.messages.filter((message) => message.id !== id);
        delete this.messageImages[id];

        if (removedPending) {
          this.pendingUserMessage = null;
        }

        if (removedStreaming) {
          this.streamingMessage = null;
        }

        if (beforeCount !== this.messages.length || removedPending || removedStreaming) {
          this.total = Math.max(0, this.total - 1);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '消息删除失败。';
        this.operationError = message;
        throw new Error(message);
      } finally {
        this.unmarkMessageMutating(id);
      }
    },
    markMessageMutating(id: string) {
      if (!this.mutatingMessageIds.includes(id)) {
        this.mutatingMessageIds = [...this.mutatingMessageIds, id];
      }
    },
    unmarkMessageMutating(id: string) {
      this.mutatingMessageIds = this.mutatingMessageIds.filter((messageId) => messageId !== id);
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
    turnId: null,
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
