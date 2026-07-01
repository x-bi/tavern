<template>
  <article class="chat-message" :class="messageClass">
    <div class="chat-message__avatar" aria-hidden="true">{{ avatarText }}</div>

    <div class="chat-message__body">
      <header class="chat-message__meta">
        <strong>{{ roleLabel }}</strong>
        <span>{{ formattedTime }}</span>
        <n-tag v-if="message.status !== 'complete'" size="small" :bordered="false">
          {{ statusLabel }}
        </n-tag>
      </header>

      <p class="chat-message__content">{{ message.content }}</p>

      <footer class="chat-message__actions">
        <n-button size="tiny" quaternary @click="$emit('copy', message)">复制</n-button>
        <n-button
          v-if="canRegenerate"
          size="tiny"
          quaternary
          :disabled="regenerateDisabled"
          @click="$emit('regenerate', message)"
        >
          重新生成
        </n-button>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Message } from '../api/messages';

const props = defineProps<{
  message: Message;
  regenerateDisabled?: boolean;
}>();

defineEmits<{
  copy: [message: Message];
  regenerate: [message: Message];
}>();

const messageClass = computed(() => ({
  'chat-message--user': props.message.role === 'user',
  'chat-message--assistant': props.message.role === 'assistant',
  'chat-message--system': props.message.role !== 'user' && props.message.role !== 'assistant'
}));

const roleLabel = computed(() => {
  switch (props.message.role) {
    case 'user':
      return '用户';
    case 'assistant':
      return 'Assistant';
    case 'system':
      return 'System';
    case 'tool':
      return 'Tool';
    default:
      return props.message.role;
  }
});

const statusLabel = computed(() => {
  switch (props.message.status) {
    case 'edited':
      return '已编辑';
    case 'deleted':
      return '已删除';
    case 'generating':
      return '生成中';
    case 'failed':
      return '失败';
    case 'stopped':
      return '已停止';
    default:
      return props.message.status;
  }
});

const avatarText = computed(() => (props.message.role === 'user' ? 'U' : 'A'));
const canRegenerate = computed(
  () =>
    props.message.role === 'assistant' &&
    props.message.status !== 'generating' &&
    props.message.status !== 'deleted'
);
const formattedTime = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(props.message.createdAt))
);
</script>

<style scoped>
.chat-message {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.chat-message--user {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.chat-message--user .chat-message__avatar {
  grid-column: 2;
  background: #1d4ed8;
}

.chat-message--user .chat-message__body {
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  background: #1e3a8a;
}

.chat-message__avatar {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: #374151;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
}

.chat-message__body {
  display: grid;
  gap: 8px;
  max-width: min(720px, 100%);
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: #18243a;
}

.chat-message--assistant .chat-message__body {
  background: #1f2937;
}

.chat-message--system .chat-message__body {
  background: #2a2337;
}

.chat-message__meta,
.chat-message__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chat-message__meta strong {
  color: var(--text-strong);
  font-size: 13px;
}

.chat-message__meta span {
  color: var(--text-muted);
  font-size: 12px;
}

.chat-message__content {
  margin: 0;
  color: #e5e7eb;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message__actions {
  min-height: 24px;
}

@media (max-width: 640px) {
  .chat-message,
  .chat-message--user {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .chat-message--user .chat-message__avatar {
    grid-column: 1;
  }

  .chat-message--user .chat-message__body {
    grid-column: 2;
    justify-self: stretch;
  }

  .chat-message__avatar {
    width: 32px;
    height: 32px;
  }
}
</style>
