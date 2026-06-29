<template>
  <main class="page-shell character-detail">
    <header class="page-shell__header character-detail__header">
      <div class="character-detail__identity">
        <n-avatar
          v-if="character?.avatarUrl"
          class="character-detail__avatar"
          round
          :size="56"
          :src="character.avatarUrl"
        />
        <n-avatar v-else class="character-detail__avatar" round :size="56">
          {{ initials }}
        </n-avatar>
        <div>
          <h2>{{ characterStore.current?.name ?? '角色详情' }}</h2>
          <p>确认角色设定，编辑后再进入会话。</p>
        </div>
      </div>

      <n-space class="character-detail__actions" justify="end">
        <n-button secondary :disabled="!character" @click="goEdit">编辑</n-button>
        <n-button secondary :disabled="!character || characterStore.saving" @click="duplicateCurrent">
          复制角色
        </n-button>
        <n-button type="primary" :disabled="!character" @click="startConversation">
          开始聊天
        </n-button>
        <n-button
          type="error"
          secondary
          :loading="characterStore.saving"
          :disabled="!character"
          @click="confirmDelete"
        >
          删除
        </n-button>
      </n-space>
    </header>

    <LoadingState v-if="characterStore.detailLoading" text="正在加载角色" />

    <ErrorState
      v-else-if="characterStore.detailError"
      title="角色加载失败"
      :description="characterStore.detailError"
    />

    <n-alert v-else-if="characterStore.saveError" type="error" :bordered="false">
      {{ characterStore.saveError }}
    </n-alert>

    <template v-if="character">
      <section class="character-detail__summary page-panel">
        <div>
          <span class="character-detail__label">更新时间</span>
          <strong>{{ updatedAtText }}</strong>
        </div>
        <div>
          <span class="character-detail__label">示例对话</span>
          <strong>{{ character.exampleMessages.length }} 条</strong>
        </div>
        <div>
          <span class="character-detail__label">状态</span>
          <strong>{{ character.isArchived ? '已归档' : '可用' }}</strong>
        </div>
      </section>

      <section v-if="tags.length > 0" class="character-detail__tags" aria-label="角色标签">
        <n-tag v-for="tag in tags" :key="tag" :bordered="false">
          {{ tag }}
        </n-tag>
      </section>

      <section class="character-detail__section page-panel">
        <h3>描述</h3>
        <p>{{ fallback(character.description) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>人格</h3>
        <p>{{ fallback(character.personality) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>场景</h3>
        <p>{{ fallback(character.scenario) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>开场白</h3>
        <p>{{ fallback(character.firstMessage) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>系统提示</h3>
        <p>{{ fallback(systemPrompt) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>创作者备注</h3>
        <p>{{ fallback(creatorNotes) }}</p>
      </section>

      <section class="character-detail__section page-panel">
        <h3>示例对话</h3>
        <div v-if="character.exampleMessages.length > 0" class="character-detail__examples">
          <article
            v-for="(message, index) in character.exampleMessages"
            :key="`${message.role}-${index}`"
            class="character-detail__example"
          >
            <span>{{ roleLabel(message.role) }}</span>
            <p>{{ message.content }}</p>
          </article>
        </div>
        <p v-else class="character-detail__empty">暂无示例对话。</p>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { useCharacterStore } from '../../stores/character';
import type { ExampleMessage } from '../../types/character';

const route = useRoute();
const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const characterStore = useCharacterStore();
const characterId = computed(() => String(route.params.id ?? ''));
const character = computed(() => characterStore.current);

const initials = computed(() => character.value?.name.trim().slice(0, 2).toUpperCase() || 'TL');

const tags = computed(() => {
  const rawTags = character.value?.metadata?.tags;

  return Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === 'string')
    : [];
});

const systemPrompt = computed(() =>
  typeof character.value?.metadata?.systemPrompt === 'string'
    ? character.value.metadata.systemPrompt
    : ''
);

const creatorNotes = computed(() =>
  typeof character.value?.metadata?.creatorNotes === 'string'
    ? character.value.metadata.creatorNotes
    : ''
);

const updatedAtText = computed(() => {
  if (!character.value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(character.value.updatedAt));
});

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

function goEdit() {
  if (!character.value) {
    return;
  }

  router.push({ name: 'character-edit', params: { id: character.value.id } });
}

async function duplicateCurrent() {
  if (!character.value) {
    return;
  }

  const duplicated = await characterStore.duplicateCharacter(character.value);

  if (!duplicated) {
    return;
  }

  message.success('角色已复制');
  router.push({ name: 'character-detail', params: { id: duplicated.id } });
}

function startConversation() {
  if (!character.value) {
    return;
  }

  message.info('会话创建将在后续阶段接入');
  router.push({
    name: 'conversations',
    query: {
      characterId: character.value.id
    }
  });
}

function confirmDelete() {
  if (!character.value) {
    return;
  }

  const current = character.value;

  dialog.warning({
    title: '删除角色',
    content: `确认删除「${current.name}」？删除后列表中不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const deleted = await characterStore.deleteCharacter(current.id);

      if (!deleted) {
        return;
      }

      message.success('角色已删除');
      router.push({ name: 'characters' });
    }
  });
}

function fallback(value: string) {
  return value.trim() || '暂未填写。';
}

function roleLabel(role: ExampleMessage['role']) {
  const labels: Record<ExampleMessage['role'], string> = {
    user: '用户',
    assistant: '角色',
    system: '系统'
  };

  return labels[role];
}
</script>

<style scoped>
.character-detail {
  align-content: start;
}

.character-detail__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.character-detail__identity {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.character-detail__avatar {
  background: #3d5a80;
  color: #f3f6fb;
  font-weight: 700;
}

.character-detail__actions {
  flex-wrap: wrap;
}

.character-detail__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
}

.character-detail__summary div {
  display: grid;
  gap: 4px;
}

.character-detail__label {
  color: var(--text-muted);
  font-size: 12px;
}

.character-detail__summary strong {
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 14px;
}

.character-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.character-detail__section {
  display: grid;
  gap: 10px;
  padding: 18px;
}

.character-detail__section h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
}

.character-detail__section p {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: var(--text-muted);
  line-height: 1.75;
}

.character-detail__examples {
  display: grid;
  gap: 10px;
}

.character-detail__example {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.character-detail__example span {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 700;
}

.character-detail__empty {
  color: var(--text-muted);
}

@media (max-width: 860px) {
  .character-detail__header,
  .character-detail__summary {
    grid-template-columns: 1fr;
  }

  .character-detail__actions {
    justify-content: flex-start;
  }
}
</style>
