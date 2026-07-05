import { defineStore } from 'pinia';

import {
  createModelConfig,
  createModelFallbackGroup as requestCreateModelFallbackGroup,
  createModelProvider as requestCreateModelProvider,
  createProviderModel as requestCreateProviderModel,
  deleteModelFallbackGroup as requestDeleteModelFallbackGroup,
  deleteModelConfig,
  deleteModelProvider as requestDeleteModelProvider,
  deleteProviderModel as requestDeleteProviderModel,
  fetchModelFallbackGroups,
  fetchModelConfigs,
  fetchModelProviders,
  fetchProviderModels,
  updateModelFallbackGroup as requestUpdateModelFallbackGroup,
  updateModelConfig,
  updateModelProvider as requestUpdateModelProvider,
  updateProviderModel as requestUpdateProviderModel,
  type ModelFallbackGroup,
  type ModelFallbackGroupMutationPayload,
  type ModelConfig,
  type ModelConfigListParams,
  type ModelConfigMutationPayload,
  type ModelProvider,
  type ModelProviderMutationPayload,
  type ProviderModel,
  type ProviderModelMutationPayload
} from '../api/models';
import type {
  ModelConfigPayload,
  ModelFallbackGroupPayload,
  ModelProviderPayload,
  ProviderModelPayload
} from '@tavern/shared';

type ModelConfigState = {
  items: ModelConfig[];
  providers: ModelProvider[];
  providerModels: ProviderModel[];
  fallbackGroups: ModelFallbackGroup[];
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
    providers: [],
    providerModels: [],
    fallbackGroups: [],
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
    hasModelConfigs: (state) => state.items.length > 0,
    hasProviders: (state) => state.providers.length > 0,
    hasProviderModels: (state) => state.providerModels.length > 0,
    hasFallbackGroups: (state) => state.fallbackGroups.length > 0
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
    async loadModelResources(params: ModelConfigListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const pageSize = params.pageSize ?? 100;
        const [providers, providerModels, fallbackGroups, legacyConfigs] =
          await Promise.all([
            fetchModelProviders({ page: 1, pageSize, search: params.search }),
            fetchProviderModels({ page: 1, pageSize, search: params.search }),
            fetchModelFallbackGroups({ page: 1, pageSize, search: params.search }),
            fetchModelConfigs({ page: 1, pageSize, search: params.search })
          ]);

        this.providers = providers.items;
        this.providerModels = providerModels.items;
        this.fallbackGroups = fallbackGroups.items;
        this.items = legacyConfigs.items;
        this.total = fallbackGroups.total;
        this.page = fallbackGroups.page;
        this.pageSize = fallbackGroups.pageSize;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '模型资源加载失败。';
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
    },
    async createProvider(payload: ModelProviderPayload): Promise<ModelProvider | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const provider = await requestCreateModelProvider(payload);
        await this.loadModelResources();

        return provider;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '供应商创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateProvider(
      id: string,
      payload: ModelProviderMutationPayload
    ): Promise<ModelProvider | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const provider = await requestUpdateModelProvider(id, payload);
        await this.loadModelResources();

        return provider;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '供应商保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteProvider(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await requestDeleteModelProvider(id);
        await this.loadModelResources();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '供应商删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    },
    async createProviderModel(payload: ProviderModelPayload): Promise<ProviderModel | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const model = await requestCreateProviderModel(payload);
        await this.loadModelResources();

        return model;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateProviderModel(
      id: string,
      payload: ProviderModelMutationPayload
    ): Promise<ProviderModel | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const model = await requestUpdateProviderModel(id, payload);
        await this.loadModelResources();

        return model;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteProviderModel(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await requestDeleteProviderModel(id);
        await this.loadModelResources();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    },
    async createFallbackGroup(
      payload: ModelFallbackGroupPayload
    ): Promise<ModelFallbackGroup | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const group = await requestCreateModelFallbackGroup(payload);
        await this.loadModelResources();

        return group;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型链创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateFallbackGroup(
      id: string,
      payload: ModelFallbackGroupMutationPayload
    ): Promise<ModelFallbackGroup | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const group = await requestUpdateModelFallbackGroup(id, payload);
        await this.loadModelResources();

        return group;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型链保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deleteFallbackGroup(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await requestDeleteModelFallbackGroup(id);
        await this.loadModelResources();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '模型链删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});
