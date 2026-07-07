import { defineStore } from 'pinia';

import {
  createModelFallbackGroup as requestCreateModelFallbackGroup,
  createModelProvider as requestCreateModelProvider,
  createProviderModel as requestCreateProviderModel,
  deleteModelFallbackGroup as requestDeleteModelFallbackGroup,
  deleteModelProvider as requestDeleteModelProvider,
  deleteProviderModel as requestDeleteProviderModel,
  fetchModelFallbackGroups,
  fetchModelProviders,
  fetchProviderModels,
  updateModelFallbackGroup as requestUpdateModelFallbackGroup,
  updateModelProvider as requestUpdateModelProvider,
  updateProviderModel as requestUpdateProviderModel,
  type ModelResourceListParams,
  type ModelFallbackGroup,
  type ModelFallbackGroupMutationPayload,
  type ModelProvider,
  type ModelProviderMutationPayload,
  type ProviderModel,
  type ProviderModelMutationPayload
} from '../api/models';
import type {
  ModelFallbackGroupPayload,
  ModelProviderPayload,
  ProviderModelPayload
} from '@tavern/shared';

type ModelResourceState = {
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
  state: (): ModelResourceState => ({
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
    hasProviders: (state) => state.providers.length > 0,
    hasProviderModels: (state) => state.providerModels.length > 0,
    hasFallbackGroups: (state) => state.fallbackGroups.length > 0
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    async loadModelResources(params: ModelResourceListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const pageSize = params.pageSize ?? 100;
        const [providers, providerModels, fallbackGroups] = await Promise.all([
          fetchModelProviders({ page: 1, pageSize, search: params.search }),
          fetchProviderModels({ page: 1, pageSize, search: params.search }),
          fetchModelFallbackGroups({ page: 1, pageSize, search: params.search })
        ]);

        this.providers = providers.items;
        this.providerModels = providerModels.items;
        this.fallbackGroups = fallbackGroups.items;
        this.total = fallbackGroups.total;
        this.page = fallbackGroups.page;
        this.pageSize = fallbackGroups.pageSize;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '模型资源加载失败。';
      } finally {
        this.loading = false;
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
