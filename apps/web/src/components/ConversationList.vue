<template>
  <section class="conversation-list" aria-label="会话列表">
    <article
      v-for="conversation in conversations"
      :key="conversation.id"
      class="conversation-list__item"
      :class="{ 'conversation-list__item--active': conversation.id === activeId }"
      @click="$emit('select', conversation)"
    >
      <div class="conversation-list__main">
        <div class="conversation-list__title-row">
          <h3>{{ conversation.title }}</h3>
        </div>
        <p>{{ conversation.character.name }}</p>
        <dl>
          <div>
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(conversation.updatedAt) }}</dd>
          </div>
          <div v-if="conversation.lastMessageAt">
            <dt>最后消息</dt>
            <dd>{{ formatDateTime(conversation.lastMessageAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="conversation-list__actions">
        <n-button
          size="small"
          secondary
          :loading="busyId === conversation.id && busyAction === 'clear'"
          @click.stop="$emit('clear', conversation)"
        >
          清空
        </n-button>
        <n-button
          size="small"
          secondary
          type="error"
          :loading="busyId === conversation.id && busyAction === 'delete'"
          @click.stop="$emit('delete', conversation)"
        >
          删除
        </n-button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { Conversation } from '../api/conversations';

defineProps<{
  conversations: Conversation[];
  activeId?: string | null;
  busyId?: string | null;
  busyAction?: 'clear' | 'delete' | null;
}>();

defineEmits<{
  select: [conversation: Conversation];
  clear: [conversation: Conversation];
  delete: [conversation: Conversation];
}>();

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
</script>

<style scoped>
.conversation-list {
  display: grid;
  gap: 12px;
}

.conversation-list__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.conversation-list__item:hover,
.conversation-list__item--active {
  border-color: rgba(96, 165, 250, 0.42);
  background: #1b2840;
}

.conversation-list__main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.conversation-list__title-row {
  min-width: 0;
}

.conversation-list__title-row h3 {
  overflow: hidden;
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-list__main p {
  overflow: hidden;
  margin: 0;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-list__main dl {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
}

.conversation-list__main dl div {
  display: flex;
  gap: 6px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.conversation-list__main dt,
.conversation-list__main dd {
  margin: 0;
}

.conversation-list__actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 760px) {
  .conversation-list__item {
    grid-template-columns: 1fr;
  }

  .conversation-list__actions {
    justify-content: flex-end;
  }
}
</style>
