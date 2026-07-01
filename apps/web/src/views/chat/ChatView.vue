<template>
  <main class="page-shell chat-view">
    <header class="page-shell__header chat-view__header">
      <div>
        <h2>聊天</h2>
        <p>展示会话历史消息，并预留后续流式聊天接入区域。</p>
      </div>
      <n-button secondary @click="goConversations">返回会话</n-button>
    </header>

    <EmptyState
      v-if="!conversationId"
      title="请选择会话"
      description="从会话列表进入聊天页后，会在这里展示历史消息。"
    />

    <div v-else class="chat-view__layout">
      <ChatRoom
        :title="conversationTitle"
        :character-name="currentConversation?.character.name"
        :messages="chatStore.messages"
        :draft="chatStore.draft"
        :loading="chatStore.loading"
        :error="chatStore.error"
        :is-generating="chatStore.isGenerating"
        @update:draft="chatStore.setDraft"
        @reload="reloadMessages"
        @send="handleSendPlaceholder"
        @stop="handleStopPlaceholder"
        @copy="copyMessage"
        @regenerate="handleRegeneratePlaceholder"
        @regenerate-latest="handleLatestRegeneratePlaceholder"
      />

      <aside class="chat-view__side" aria-label="会话配置占位">
        <section class="chat-view__side-section">
          <h3>角色</h3>
          <p>{{ currentConversation?.character.name ?? '未加载' }}</p>
        </section>

        <section class="chat-view__side-section">
          <h3>模型</h3>
          <p>{{ modelLabel }}</p>
        </section>

        <section class="chat-view__side-section">
          <h3>预设</h3>
          <p>{{ presetLabel }}</p>
        </section>

        <section class="chat-view__side-section">
          <h3>Persona</h3>
          <p>{{ personaLabel }}</p>
        </section>

        <section class="chat-view__side-section">
          <h3>工具栏</h3>
          <div class="chat-view__tool-grid">
            <n-button size="small" secondary disabled>Prompt</n-button>
            <n-button size="small" secondary disabled>世界书</n-button>
            <n-button size="small" secondary disabled>导出</n-button>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';

import type { Message } from '../../api/messages';
import ChatRoom from '../../components/ChatRoom.vue';
import EmptyState from '../../components/EmptyState.vue';
import { useChatStore } from '../../stores/chat';
import { useConversationStore } from '../../stores/conversation';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const chatStore = useChatStore();
const conversationStore = useConversationStore();

const conversationId = computed(() => {
  const value = route.params.conversationId;

  return typeof value === 'string' ? value : null;
});

const currentConversation = computed(() => {
  if (!conversationId.value) {
    return null;
  }

  return conversationStore.items.find((item) => item.id === conversationId.value) ?? null;
});

const conversationTitle = computed(() => currentConversation.value?.title ?? '聊天会话');
const modelLabel = computed(() => {
  const modelConfig = currentConversation.value?.modelConfig;

  return modelConfig ? `${modelConfig.name} / ${modelConfig.modelName}` : '未选择';
});
const presetLabel = computed(() => currentConversation.value?.promptPreset?.name ?? '未选择');
const personaLabel = computed(() => currentConversation.value?.persona?.name ?? '未选择');

onMounted(() => {
  void loadCurrentRoom();
});

watch(
  () => conversationId.value,
  () => {
    void loadCurrentRoom();
  }
);

async function loadCurrentRoom() {
  if (!conversationId.value) {
    chatStore.reset();

    return;
  }

  await Promise.allSettled([
    conversationStore.loadConversations({ page: 1, pageSize: 100 }),
    chatStore.loadMessages(conversationId.value, { page: 1, pageSize: 100, order: 'asc' })
  ]);
}

function reloadMessages() {
  if (!conversationId.value) {
    return;
  }

  void chatStore.loadMessages(conversationId.value, { page: 1, pageSize: 100, order: 'asc' });
}

function goConversations() {
  void router.push({ name: 'conversations' });
}

function handleSendPlaceholder() {
  message.info('发送消息会在后续流式聊天阶段接入。');
}

function handleStopPlaceholder() {
  message.info('停止生成会在后续阶段接入。');
}

function handleRegeneratePlaceholder() {
  message.info('重新生成会在后续阶段接入。');
}

function handleLatestRegeneratePlaceholder() {
  message.info('重新生成最新回复会在后续阶段接入。');
}

async function copyMessage(target: Message) {
  try {
    await navigator.clipboard.writeText(target.content);
    message.success('消息已复制');
  } catch {
    message.warning('当前浏览器不允许直接复制，请手动选择文本。');
  }
}
</script>

<style scoped>
.chat-view {
  align-content: start;
}

.chat-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.chat-view__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  align-items: stretch;
}

.chat-view__side {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.chat-view__side-section {
  display: grid;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.chat-view__side-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.chat-view__side-section h3,
.chat-view__side-section p {
  margin: 0;
}

.chat-view__side-section h3 {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.chat-view__side-section p {
  overflow: hidden;
  color: var(--text-strong);
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-view__tool-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 1020px) {
  .chat-view__layout {
    grid-template-columns: 1fr;
  }

  .chat-view__side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .chat-view__header,
  .chat-view__side {
    grid-template-columns: 1fr;
  }
}
</style>
