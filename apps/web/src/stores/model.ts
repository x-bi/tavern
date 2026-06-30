import { defineStore } from 'pinia';

import {
  createModelConfig,
  deleteModelConfig,
  fetchModelConfigs,
  updateModelConfig,
  type ModelConfig,
  type ModelConfigListParams,
  type ModelConfigMutationPayload
} from '../api/models';
import type { ModelConfigPayload } from '@tavern/shared';

type ModelConfigState = {
  items: ModelConfig[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
};

export const useModelStore = defineStore('model', {
  state: (): ModelConfigState => ({
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
    hasModelConfigs: (state) => state.items.length > 0
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    async loadModelConfigs(params: ModelConfigListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchModelConfigs({
          page,
          pageSize,
          search: search.trim() || undefined
        });

        this.items = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
        this.search = search;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '模型配置加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async createModelConfig(payload: ModelConfigPayload): Promise<ModelConfig | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const modelConfig = await createModelConfig(payload);

        await this.loadModelConfigs({ page: 1 });

        return modelConfig;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型配置创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateModelConfig(
      id: string,
      payload: ModelConfigMutationPayload
    ): Promise<ModelConfig | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const modelConfig = await updateModelConfig(id, payload);

        await this.loadModelConfigs();

        return modelConfig;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型配置保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteModelConfig(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deleteModelConfig(id);
        this.items = this.items.filter((item) => item.id !== id);
        await this.loadModelConfigs();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型配置删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});
