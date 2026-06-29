import { defineStore } from 'pinia';

import {
  createCharacter,
  deleteCharacter,
  fetchCharacters,
  fetchCharacter,
  updateCharacter,
  type Character,
  type CharacterListParams
} from '../api/characters';
import type { CharacterMutationPayload } from '../types/character';

type CharacterState = {
  items: Character[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  current: Character | null;
  loading: boolean;
  detailLoading: boolean;
  saving: boolean;
  error: string | null;
  detailError: string | null;
  saveError: string | null;
};

export const useCharacterStore = defineStore('character', {
  state: (): CharacterState => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    current: null,
    loading: false,
    detailLoading: false,
    saving: false,
    error: null,
    detailError: null,
    saveError: null
  }),
  getters: {
    hasCharacters: (state) => state.items.length > 0
  },
  actions: {
    setSearch(value: string) {
      this.search = value;
    },
    async loadCharacters(params: CharacterListParams = {}) {
      this.loading = true;
      this.error = null;

      try {
        const page = params.page ?? this.page;
        const pageSize = params.pageSize ?? this.pageSize;
        const search = params.search ?? this.search;
        const result = await fetchCharacters({
          page,
          pageSize,
          search: search.trim() || undefined,
          isArchived: false
        });

        this.items = result.items;
        this.total = result.total;
        this.page = result.page;
        this.pageSize = result.pageSize;
        this.search = search;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '角色列表加载失败。';
      } finally {
        this.loading = false;
      }
    },
    async loadCharacter(id: string): Promise<Character | null> {
      this.detailLoading = true;
      this.detailError = null;
      this.saveError = null;
      this.current = null;

      try {
        const character = await fetchCharacter(id);

        this.current = character;

        return character;
      } catch (error) {
        this.detailError = error instanceof Error ? error.message : '角色详情加载失败。';
        this.current = null;

        return null;
      } finally {
        this.detailLoading = false;
      }
    },
    async createCharacter(payload: CharacterMutationPayload): Promise<Character | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const character = await createCharacter(payload);

        this.current = character;
        await this.loadCharacters({ page: 1 });

        return character;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '角色创建失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateCharacter(
      id: string,
      payload: CharacterMutationPayload
    ): Promise<Character | null> {
      this.saving = true;
      this.saveError = null;

      try {
        const character = await updateCharacter(id, payload);

        this.current = character;
        await this.loadCharacters();

        return character;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '角色保存失败。';

        return null;
      } finally {
        this.saving = false;
      }
    },
    async duplicateCharacter(source: Character): Promise<Character | null> {
      return this.createCharacter({
        avatarAssetId: source.avatarAssetId,
        name: `${source.name} 副本`,
        description: source.description,
        personality: source.personality,
        scenario: source.scenario,
        firstMessage: source.firstMessage,
        exampleMessages: source.exampleMessages.map((message) => ({ ...message })),
        metadata: cloneMetadata(source.metadata)
      });
    },
    async deleteCharacter(id: string): Promise<boolean> {
      this.saving = true;
      this.saveError = null;

      try {
        await deleteCharacter(id);

        this.items = this.items.filter((item) => item.id !== id);

        if (this.current?.id === id) {
          this.current = null;
        }

        await this.loadCharacters();

        return true;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : '角色删除失败。';

        return false;
      } finally {
        this.saving = false;
      }
    }
  }
});

function cloneMetadata(metadata: Character['metadata']): CharacterMutationPayload['metadata'] {
  if (!metadata) {
    return {};
  }

  return JSON.parse(JSON.stringify(metadata)) as CharacterMutationPayload['metadata'];
}
