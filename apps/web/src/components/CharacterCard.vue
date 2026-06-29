<template>
  <n-card class="character-card" :bordered="false">
    <div class="character-card__body">
      <n-avatar
        v-if="character.avatarUrl"
        class="character-card__avatar"
        round
        :size="48"
        :src="character.avatarUrl"
      />
      <n-avatar v-else class="character-card__avatar" round :size="48">
        {{ initials }}
      </n-avatar>

      <div class="character-card__content">
        <div class="character-card__heading">
          <h3>{{ character.name }}</h3>
          <n-tag v-if="character.isArchived" size="small" type="warning" :bordered="false">
            已归档
          </n-tag>
        </div>

        <p class="character-card__summary">{{ summary }}</p>

        <div v-if="tags.length > 0" class="character-card__tags">
          <n-tag v-for="tag in tags" :key="tag" size="small" :bordered="false">
            {{ tag }}
          </n-tag>
        </div>

        <div class="character-card__meta">
          <span>{{ exampleCountText }}</span>
          <span>更新于 {{ updatedAtText }}</span>
        </div>
      </div>
    </div>

    <template #action>
      <div class="character-card__actions">
        <n-button size="small" secondary @click="$emit('view', character.id)">查看</n-button>
        <n-button size="small" secondary @click="$emit('edit', character.id)">编辑</n-button>
      </div>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Character } from '../api/characters';

const props = defineProps<{
  character: Character;
}>();

defineEmits<{
  view: [id: string];
  edit: [id: string];
}>();

const initials = computed(() => props.character.name.trim().slice(0, 2).toUpperCase() || 'TL');

const summary = computed(() => {
  const fields = [
    props.character.description,
    props.character.personality,
    props.character.scenario,
    props.character.firstMessage
  ];

  return fields.find((field) => field.trim()) ?? '这个角色还没有简介。';
});

const tags = computed(() => {
  const rawTags = props.character.metadata?.tags;

  return Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 4)
    : [];
});

const exampleCountText = computed(() => {
  const count = props.character.exampleMessages.length;

  return count > 0 ? `${count} 条示例对话` : '无示例对话';
});

const updatedAtText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(props.character.updatedAt))
);
</script>

<style scoped>
.character-card {
  height: 100%;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.character-card__body {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
}

.character-card__avatar {
  background: #3d5a80;
  color: #f3f6fb;
  font-weight: 700;
}

.character-card__content {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.character-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.character-card__heading h3 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 16px;
  line-height: 1.35;
}

.character-card__summary {
  display: -webkit-box;
  min-height: 44px;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--text-muted);
  line-height: 1.6;
}

.character-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.character-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--text-muted);
  font-size: 12px;
}

.character-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
