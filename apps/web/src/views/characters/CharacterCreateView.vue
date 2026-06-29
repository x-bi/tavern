<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>新建角色</h2>
      <p>填写角色卡核心字段，保存后进入角色详情。</p>
    </header>

    <CharacterEditor
      submit-label="创建角色"
      :submitting="characterStore.saving"
      :error="characterStore.saveError"
      @submit="handleSubmit"
      @cancel="goBack"
    />
  </main>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';

import CharacterEditor from '../../components/CharacterEditor.vue';
import { useCharacterStore } from '../../stores/character';
import type { CharacterMutationPayload } from '../../types/character';

const router = useRouter();
const message = useMessage();
const characterStore = useCharacterStore();

async function handleSubmit(payload: CharacterMutationPayload) {
  const character = await characterStore.createCharacter(payload);

  if (!character) {
    return;
  }

  message.success('角色已创建');
  router.push({ name: 'character-detail', params: { id: character.id } });
}

function goBack() {
  router.push({ name: 'characters' });
}
</script>
