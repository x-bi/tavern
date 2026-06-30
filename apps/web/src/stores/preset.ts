import { defineStore } from 'pinia';

import {
  createPromptPreset,
  deletePromptPreset,
  fetchPromptPresets,
  updatePromptPreset,
  type PromptPreset,
  type PromptPresetListParams,
  type PromptPresetMutationPayload
} from '../api/presets';
import type { PromptPresetPayload } from '@tavern/shared';

type PromptPresetState = {
  items: PromptPreset[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
};

export const usePresetStore = defineStore('preset', {
  state: (): PromptPresetState => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    loading: false,
    saving: false,
    error: null,
    saveError: null
  }),
  getters: {
    hasPresets: (state) => state.items.length > 0
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    async loadPresets(params: PromptPresetListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchPromptPresets({
          page,
          pageSize,
          search: search.trim() || undefined,
          isDefault: params.isDefault
        });

        this.items = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
        this.search = search;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '参数预设加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async createPreset(payload: PromptPresetPayload): Promise<PromptPreset | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const preset = await createPromptPreset(payload);

        await this.loadPresets({ page: 1 });

        return preset;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '参数预设创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updatePreset(
      id: string,
      payload: PromptPresetMutationPayload
    ): Promise<PromptPreset | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const preset = await updatePromptPreset(id, payload);

        await this.loadPresets();

        return preset;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '参数预设保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async setDefaultPreset(id: string): Promise<PromptPreset | null> {
      return this.updatePreset(id, {
        isDefault: true
      });
    },
    async deletePreset(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deletePromptPreset(id);
        this.items = this.items.filter((item) => item.id !== id);
        await this.loadPresets();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '参数预设删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});
