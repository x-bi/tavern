<template>
  <section class="chat-room">
    <header class="chat-room__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <n-button secondary :loading="loading" @click="$emit('reload')">刷新消息</n-button>
    </header>

    <div ref="messageListRef" class="chat-room__messages" aria-label="消息列表">
      <LoadingState v-if="loading" text="正在加载消息" />

      <ErrorState v-else-if="error" title="消息加载失败" :description="error" />

      <EmptyState
        v-else-if="messages.length === 0"
        title="还没有消息"
        description="本阶段只展示历史消息，发送和流式回复会在后续阶段接入。"
      />

      <template v-else>
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          @copy="$emit('copy', $event)"
          @regenerate="$emit('regenerate', $event)"
        />
      </template>
    </div>

    <ChatInput
      :model-value="draft"
      :is-generating="isGenerating"
      @update:model-value="$emit('update:draft', $event)"
      @send="$emit('send')"
      @stop="$emit('stop')"
      @regenerate="$emit('regenerate-latest')"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import type { Message } from '../api/messages';
import ChatInput from './ChatInput.vue';
import ChatMessage from './ChatMessage.vue';
import EmptyState from './EmptyState.vue';
import ErrorState from './ErrorState.vue';
import LoadingState from './LoadingState.vue';

const props = defineProps<{
  title: string;
  characterName?: string | null;
  messages: Message[];
  draft: string;
  loading?: boolean;
  error?: string | null;
  isGenerating?: boolean;
}>();

defineEmits<{
  'update:draft': [value: string];
  reload: [];
  send: [];
  stop: [];
  copy: [message: Message];
  regenerate: [message: Message];
  'regenerate-latest': [];
}>();

const messageListRef = ref<HTMLElement | null>(null);
const subtitle = computed(() => props.characterName ?? '未选择角色');
const messageSignature = computed(() =>
  props.messages.map((message) => `${message.id}:${message.status}:${message.content.length}`).join('|')
);

watch(
  () => messageSignature.value,
  () => {
    void scrollToBottom();
  },
  {
    flush: 'post'
  }
);

async function scrollToBottom() {
  await nextTick();

  const element = messageListRef.value;

  if (!element) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}
</script>

<style scoped>
.chat-room {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: min(720px, calc(100vh - 150px));
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.chat-room__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line-subtle);
}

.chat-room__header h3,
.chat-room__header p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-room__header h3 {
  color: var(--text-strong);
  font-size: 16px;
}

.chat-room__header p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.chat-room__messages {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 320px;
  overflow-y: auto;
  padding: 18px;
}

@media (max-width: 720px) {
  .chat-room {
    min-height: calc(100vh - 150px);
  }

  .chat-room__header {
    grid-template-columns: 1fr;
  }
}
</style>
