import { defineStore } from 'pinia';

import {
  createWorldBook,
  createWorldBookEntry,
  deleteWorldBook,
  deleteWorldBookEntry,
  fetchWorldBook,
  fetchWorldBooks,
  updateWorldBook,
  updateWorldBookEntry,
  type WorldBook,
  type WorldBookEntry,
  type WorldBookEntryMutationPayload,
  type WorldBookListParams,
  type WorldBookMutationPayload
} from '../api/worldBooks';
import type { WorldBookEntryPayload, WorldBookPayload } from '@tavern/shared';

type WorldBookState = {
  items: WorldBook[];
  selectedId: string | null;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  loading: boolean;
  saving: boolean;
  entrySaving: boolean;
  error: string | null;
  saveError: string | null;
  entryError: string | null;
};

export const useWorldBookStore = defineStore('worldBook', {
  state: (): WorldBookState => ({
    items: [],
    selectedId: null,
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    loading: false,
    saving: false,
    entrySaving: false,
    error: null,
    saveError: null,
    entryError: null
  }),
  getters: {
    hasWorldBooks: (state) => state.items.length > 0,
    selectedWorldBook: (state) =>
      state.items.find((worldBook) => worldBook.id === state.selectedId) ?? null
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    selectWorldBook(id: string | null) {
      this.selectedId = id;
      this.saveError = null;
      this.entryError = null;
    },
    async loadWorldBooks(params: WorldBookListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchWorldBooks({
          page,
          pageSize,
          search: search.trim() || undefined,
          characterId: params.characterId,
          isEnabled: params.isEnabled
        });

        this.items = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
        this.search = search;

        if (!this.selectedId || !this.items.some((item) => item.id === this.selectedId)) {
          this.selectedId = this.items[0]?.id ?? null;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '世界书加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async refreshWorldBook(id: string): Promise<WorldBook | null> {
      try {
        const worldBook = await fetchWorldBook(id);
        this.upsertWorldBook(worldBook);

        return worldBook;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '世界书刷新失败。';

        return null;
      }
    },
    async createWorldBook(payload: WorldBookPayload): Promise<WorldBook | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const worldBook = await createWorldBook(payload);

        await this.loadWorldBooks({ page: 1 });
        this.selectedId = worldBook.id;

        return worldBook;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '世界书创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateWorldBook(
      id: string,
      payload: WorldBookMutationPayload
    ): Promise<WorldBook | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const worldBook = await updateWorldBook(id, payload);
        this.upsertWorldBook(worldBook);

        return worldBook;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '世界书保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteWorldBook(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deleteWorldBook(id);
        this.items = this.items.filter((item) => item.id !== id);

        if (this.selectedId === id) {
          this.selectedId = this.items[0]?.id ?? null;
        }

        await this.loadWorldBooks();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '世界书删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    },
    async createEntry(
      worldBookId: string,
      payload: WorldBookEntryPayload
    ): Promise<WorldBookEntry | null> {
      this.entrySaving = true;
      this.entryError = null;

      try {
        const entry = await createWorldBookEntry(worldBookId, payload);
        await this.refreshWorldBook(worldBookId);

        return entry;
      } catch (error) {
        this.entryError = error instanceof Error ? error.message : '世界书条目创建失败。';

        return null;
      } finally {
        this.entrySaving = false;
      }
    },
    async updateEntry(
      id: string,
      payload: WorldBookEntryMutationPayload
    ): Promise<WorldBookEntry | null> {
      this.entrySaving = true;
      this.entryError = null;

      try {
        const entry = await updateWorldBookEntry(id, payload);
        await this.refreshWorldBook(entry.worldBookId);

        return entry;
      } catch (error) {
        this.entryError = error instanceof Error ? error.message : '世界书条目保存失败。';

        return null;
      } finally {
        this.entrySaving = false;
      }
    },
    async deleteEntry(id: string, worldBookId: string): Promise<boolean> {
      this.entrySaving = true;
      this.entryError = null;

      try {
        await deleteWorldBookEntry(id);
        await this.refreshWorldBook(worldBookId);

        return true;
      } catch (error) {
        this.entryError = error instanceof Error ? error.message : '世界书条目删除失败。';

        return false;
      } finally {
        this.entrySaving = false;
      }
    },
    upsertWorldBook(worldBook: WorldBook) {
      const index = this.items.findIndex((item) => item.id === worldBook.id);

      if (index >= 0) {
        this.items.splice(index, 1, worldBook);
      } else {
        this.items.unshift(worldBook);
      }
    }
  }
});
