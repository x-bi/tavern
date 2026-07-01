import { defineStore } from 'pinia';

import { fetchConversationMessages, type Message, type MessageListParams } from '../api/messages';

type ChatState = {
  conversationId: string | null;
  messages: Message[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  draft: string;
  isGenerating: boolean;
};

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    conversationId: null,
    messages: [],
    total: 0,
    page: 1,
    pageSize: 100,
    loading: false,
    error: null,
    draft: '',
    isGenerating: false
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0
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
      this.draft = '';
      this.isGenerating = false;
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
