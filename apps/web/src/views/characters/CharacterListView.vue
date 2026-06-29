<template>
  <main class="page-shell character-list">
    <header class="page-shell__header character-list__header">
      <div>
        <h2>角色</h2>
        <p>管理本地角色卡，进入详情或编辑后续信息。</p>
      </div>
      <n-button type="primary" @click="goCreate">新建角色</n-button>
    </header>

    <section class="character-list__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索名称、简介、性格或场景"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState v-if="characterStore.loading" text="正在加载角色" />

    <ErrorState
      v-else-if="characterStore.error"
      title="角色列表加载失败"
      :description="characterStore.error"
    />

    <EmptyState
      v-else-if="!characterStore.hasCharacters"
      title="还没有角色"
      description="创建第一个角色后，它会出现在这里。"
    />

    <section v-else class="character-list__grid" aria-label="角色列表">
      <CharacterCard
        v-for="character in characterStore.items"
        :key="character.id"
        :character="character"
        @view="goDetail"
        @edit="goEdit"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import CharacterCard from '../../components/CharacterCard.vue';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { useCharacterStore } from '../../stores/character';

const router = useRouter();
const characterStore = useCharacterStore();
const searchText = ref(characterStore.search);

onMounted(() => {
  void characterStore.loadCharacters();
});

function applySearch() {
  characterStore.setSearch(searchText.value);
  void characterStore.loadCharacters({
    page: 1,
    search: searchText.value
  });
}

function goCreate() {
  router.push({ name: 'character-create' });
}

function goDetail(id: string) {
  router.push({ name: 'character-detail', params: { id } });
}

function goEdit(id: string) {
  router.push({ name: 'character-edit', params: { id } });
}
</script>

<style scoped>
.character-list {
  align-content: start;
}

.character-list__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.character-list__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 420px) auto;
  gap: 10px;
  align-items: center;
}

.character-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

@media (max-width: 720px) {
  .character-list__header,
  .character-list__toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
