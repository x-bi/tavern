<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>编辑角色</h2>
      <p>更新角色卡核心字段，保存后返回角色详情。</p>
    </header>

    <LoadingState v-if="characterStore.detailLoading" text="正在加载角色" />

    <ErrorState
      v-else-if="characterStore.detailError"
      title="角色加载失败"
      :description="characterStore.detailError"
    />

    <CharacterEditor
      v-else-if="characterStore.current"
      :initial-value="characterStore.current"
      submit-label="保存修改"
      :submitting="characterStore.saving"
      :error="characterStore.saveError"
      @submit="handleSubmit"
      @cancel="goBack"
    />
  </main>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CharacterEditor from '../../components/CharacterEditor.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { useCharacterStore } from '../../stores/character';
import type { CharacterMutationPayload } from '../../types/character';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const characterStore = useCharacterStore();
const characterId = computed(() => String(route.params.id ?? ''));

onMounted(() => {
  void loadCharacter();
});

watch(characterId, () => {
  void loadCharacter();
});

async function loadCharacter() {
  if (!characterId.value) {
    router.push({ name: 'characters' });
    return;
  }

  await characterStore.loadCharacter(characterId.value);
}

async function handleSubmit(payload: CharacterMutationPayload) {
  const character = await characterStore.updateCharacter(characterId.value, payload);

  if (!character) {
    return;
  }

  message.success('角色已保存');
  router.push({ name: 'character-detail', params: { id: character.id } });
}

function goBack() {
  router.push({ name: 'character-detail', params: { id: characterId.value } });
}
</script>
