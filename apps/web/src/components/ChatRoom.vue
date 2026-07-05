<template>
  <section class="chat-room">
    <header class="chat-room__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <n-button secondary :loading="loading" :disabled="isGenerating" @click="$emit('reload')">
        刷新消息
      </n-button>
    </header>

    <div ref="messageListRef" class="chat-room__messages" aria-label="消息列表" @scroll="handleScroll">
      <LoadingState v-if="loading" text="正在加载消息" />

      <ErrorState v-else-if="error" title="消息加载失败" :description="error" />

      <EmptyState
        v-else-if="messages.length === 0"
        title="还没有消息"
        description="输入消息后，assistant 回复会在这里流式显示。"
      />

      <template v-else>
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :regenerate-disabled="isGenerating"
          :operation-pending="mutatingMessageIds.includes(message.id)"
          :edit-disabled="isGenerating"
          :delete-disabled="isGenerating"
          @copy="$emit('copy', $event)"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
          @regenerate="$emit('regenerate', $event)"
        />
      </template>
    </div>

    <n-alert
      v-if="sendError"
      class="chat-room__send-error"
      type="error"
      title="发送失败"
      :bordered="false"
    >
      {{ sendError }}
    </n-alert>

    <ChatInput
      :model-value="draft"
      :sending="sending"
      :is-generating="isGenerating"
      :can-stop="canStop"
      :stopping="stopping"
      @update:model-value="$emit('update:draft', $event)"
      @send="$emit('send')"
      @stop="$emit('stop')"
      @regenerate="$emit('regenerate-latest')"
      @preview-prompt="$emit('preview-prompt')"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import type { Message } from '../api/messages';
import ChatInput from './ChatInput.vue';
import ChatMessage from './ChatMessage.vue';
import EmptyState from './EmptyState.vue';
import ErrorState from './ErrorState.vue';
import LoadingState from './LoadingState.vue';

const props = withDefaults(
  defineProps<{
  title: string;
  characterName?: string | null;
  messages: Message[];
  draft: string;
  loading?: boolean;
  error?: string | null;
  sendError?: string | null;
  sending?: boolean;
  isGenerating?: boolean;
  canStop?: boolean;
  stopping?: boolean;
  mutatingMessageIds?: string[];
  }>(),
  {
    mutatingMessageIds: () => []
  }
);

defineEmits<{
  'update:draft': [value: string];
  reload: [];
  send: [];
  stop: [];
  copy: [message: Message];
  edit: [
    payload: {
      message: Message;
      content: string;
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  ];
  delete: [message: Message];
  regenerate: [message: Message];
  'regenerate-latest': [];
  'preview-prompt': [];
}>();

const messageListRef = ref<HTMLElement | null>(null);
const subtitle = computed(() => props.characterName ?? '未选择角色');
// 用户是否贴近底部：true 时随消息增长自动滚到底；用户向上滚阅读历史时置 false，不被打断
const stickToBottom = ref(true);
const messageSignature = computed(() =>
  props.messages.map((message) => `${message.id}:${message.status}:${message.content.length}`).join('|')
);

/** 贴底判定阈值（px）：距底部小于该值视为“在底部”。 */
const STICK_TO_BOTTOM_THRESHOLD = 80;
let pendingScrollRaf = 0;

function handleScroll() {
  const element = messageListRef.value;

  if (!element) {
    return;
  }

  // 用户主动滚动后重新判定是否贴底：贴近则锁定跟随，远离则解锁
  stickToBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_THRESHOLD;
}

watch(
  () => messageSignature.value,
  () => {
    scrollToBottom();
  },
  {
    flush: 'post'
  }
);

function scrollToBottom() {
  const element = messageListRef.value;

  // 贴底才跟随：用户正在向上阅读历史时不强制拉回底部
  if (!element || !stickToBottom.value) {
    return;
  }

  // 用 rAF 节流：流式 delta 高频触发时只保留最后一帧，等布局稳定后再滚动
  if (pendingScrollRaf) {
    cancelAnimationFrame(pendingScrollRaf);
  }

  pendingScrollRaf = requestAnimationFrame(() => {
    pendingScrollRaf = 0;

    const target = messageListRef.value;

    if (target) {
      target.scrollTop = target.scrollHeight;
    }
  });
}

watch(
  () => props.isGenerating,
  (generating, wasGenerating) => {
    // 开始新一轮生成（发送 / 重新生成）：用户主动发起，显然要看最新回复，强制贴底
    if (generating && !wasGenerating) {
      stickToBottom.value = true;
      scrollToBottom();
    }
  }
);

onBeforeUnmount(() => {
  if (pendingScrollRaf) {
    cancelAnimationFrame(pendingScrollRaf);
    pendingScrollRaf = 0;
  }
});
</script>

<style scoped>
.chat-room {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  /* 占满父 grid cell（grid 默认 stretch），不设 max-height/align-self，
     大屏也精确填满，不再有下方留白 */
  min-height: 0;
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
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
  /* Firefox：细滚动条，半透明融合深色面板 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

/* WebKit：细、半透明、圆角，hover 加深；不抢占内容宽度 */
.chat-room__messages::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.chat-room__messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-room__messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.chat-room__messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.22);
}

.chat-room__send-error {
  margin: 0 12px 12px;
}

@media (max-width: 720px) {
  /* 小屏：chat-view 高度已转为 auto，这里让 chat-room 占首屏、内部滚动 */
  .chat-room {
    max-height: calc(100vh - 150px);
  }

  .chat-room__header {
    grid-template-columns: 1fr;
  }
}
</style>
