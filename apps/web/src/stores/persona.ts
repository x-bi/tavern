import { defineStore } from 'pinia';

import {
  createPersona,
  deletePersona,
  fetchPersonas,
  setDefaultPersona,
  updatePersona,
  type Persona,
  type PersonaListParams,
  type PersonaMutationPayload
} from '../api/personas';
import type { PersonaPayload } from '@tavern/shared';

type PersonaState = {
  items: Persona[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
};

export const usePersonaStore = defineStore('persona', {
  state: (): PersonaState => ({
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
    hasPersonas: (state) => state.items.length > 0,
    defaultPersona: (state) => state.items.find((item) => item.isDefault) ?? null
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    async loadPersonas(params: PersonaListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchPersonas({
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
        this.error = error instanceof Error ? error.message : 'Persona 加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async createPersona(payload: PersonaPayload): Promise<Persona | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const persona = await createPersona(payload);

        await this.loadPersonas({ page: 1 });

        return persona;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Persona 创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updatePersona(id: string, payload: PersonaMutationPayload): Promise<Persona | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const persona = await updatePersona(id, payload);

        await this.loadPersonas();

        return persona;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Persona 保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async setDefaultPersona(id: string): Promise<Persona | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const persona = await setDefaultPersona(id);

        await this.loadPersonas();

        return persona;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '默认 Persona 设置失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async deletePersona(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deletePersona(id);
        this.items = this.items.filter((item) => item.id !== id);
        await this.loadPersonas();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Persona 删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});
