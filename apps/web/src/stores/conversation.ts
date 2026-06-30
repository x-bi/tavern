import { defineStore } from 'pinia';

import {
  clearConversation,
  createConversation,
  deleteConversation,
  fetchConversations,
  updateConversation,
  type Conversation,
  type ConversationListParams,
  type ConversationMutationPayload
} from '../api/conversations';
import type { ConversationPayload } from '@tavern/shared';

type ConversationState = {
  items: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  currentId: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
};

export const useConversationStore = defineStore('conversation', {
  state: (): ConversationState => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    currentId: null,
    loading: false,
    saving: false,
    error: null,
    saveError: null
  }),
  getters: {
    hasConversations: (state) => state.items.length > 0,
    currentConversation: (state) =>
      state.items.find((item) => item.id === state.currentId) ?? null
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    setCurrent(id: string | null) {
      this.currentId = id;
    },
    async loadConversations(params: ConversationListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchConversations({
          ...params,
          page,
          pageSize,
          search: search.trim() || undefined,
          status: params.status ?? 'active'
        });

        this.items = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
        this.search = search;

        if (this.currentId && !this.items.some((item) => item.id === this.currentId)) {
          this.currentId = null;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '会话列表加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async createConversation(payload: ConversationPayload): Promise<Conversation | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const conversation = await createConversation(payload);

        this.currentId = conversation.id;
        await this.loadConversations({ page: 1 });

        return conversation;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '会话创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateConversation(
      id: string,
      payload: ConversationMutationPayload
    ): Promise<Conversation | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const conversation = await updateConversation(id, payload);

        await this.loadConversations();

        return conversation;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '会话保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteConversation(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deleteConversation(id);
        this.items = this.items.filter((item) => item.id !== id);

        if (this.currentId === id) {
          this.currentId = null;
        }

        await this.loadConversations();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '会话删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    },
    async clearConversation(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await clearConversation(id);
        await this.loadConversations();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '会话清空失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});
