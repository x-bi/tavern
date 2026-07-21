<template>
  <main class="page-shell chat-view">
    <header class="page-shell__header chat-view__header">
      <div>
        <h2>聊天</h2>
        <p>发送用户消息后，角色回复会在消息列表中流式增长。</p>
      </div>
      <n-space>
        <ShareManager
          v-if="conversationId"
          target-type="conversation"
          :target-id="conversationId"
        />
        <n-button v-if="conversationId" secondary @click="openConversationSettings">
          会话设置
        </n-button>
        <n-button secondary @click="goConversations">返回会话</n-button>
      </n-space>
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
        :character-avatar-url="currentConversation?.character.avatarUrl"
        :user-name="currentConversation?.persona?.name"
        :messages="chatStore.visibleMessages"
        :draft="chatStore.draft"
        :loading="chatStore.loading"
        :error="chatStore.error"
        :send-error="chatStore.sendError"
        :sending="chatStore.sending"
        :is-generating="chatStore.isGenerating"
        :can-stop="chatStore.canStop"
        :stopping="chatStore.stopping"
        :mutating-message-ids="chatStore.mutatingMessageIds"
        :suggestions="chatStore.suggestions"
        :suggestions-loading="chatStore.suggestionsLoading"
        :suggestions-error="chatStore.suggestionsError"
        @update:draft="chatStore.setDraft"
        @reload="reloadMessages"
        @send="handleSend"
        @stop="handleStop"
        @copy="copyMessage"
        @edit="handleEdit"
        @delete="confirmDelete"
        @regenerate="handleRegenerate"
        @regenerate-latest="handleLatestRegeneratePlaceholder"
        @preview-prompt="goPromptPreview"
        @request-suggestions="handleSuggestions"
        @apply-suggestion="chatStore.applySuggestion"
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
            <n-button size="small" secondary @click="goPromptPreview">Prompt</n-button>
            <n-button size="small" secondary @click="goWorldBook">世界书</n-button>
            <n-button size="small" secondary disabled>导出</n-button>
          </div>
        </section>
      </aside>
    </div>

    <n-drawer v-model:show="settingsVisible" placement="right" :width="settingsDrawerWidth">
      <n-drawer-content title="会话设置" closable>
        <n-form label-placement="top" @submit.prevent="saveConversationSettings">
          <n-form-item label="标题" required>
            <n-input v-model:value="settingsForm.title" maxlength="160" />
          </n-form-item>
          <n-form-item label="角色">
            <NSelect
              v-model:value="settingsForm.characterId"
              :options="characterOptions"
              :disabled="hasConversationMessages"
            />
            <template #feedback>
              {{
                hasConversationMessages ? '会话已有消息，角色不可更换。' : '仅空会话可更换角色。'
              }}
            </template>
          </n-form-item>
          <n-form-item label="模型链">
            <NSelect
              v-model:value="settingsForm.modelFallbackGroupId"
              clearable
              :options="modelOptions"
              placeholder="未选择"
            />
          </n-form-item>
          <n-form-item label="Prompt 预设">
            <NSelect
              v-model:value="settingsForm.promptPresetId"
              clearable
              :options="presetOptions"
              placeholder="未选择"
            />
          </n-form-item>
          <n-form-item label="Persona">
            <NSelect
              v-model:value="settingsForm.personaId"
              clearable
              :options="personaOptions"
              placeholder="未选择"
            />
          </n-form-item>
          <n-form-item label="状态">
            <NSelect v-model:value="settingsForm.status" :options="statusOptions" />
          </n-form-item>
          <n-alert v-if="conversationStore.saveError" type="error" :bordered="false">
            {{ conversationStore.saveError }}
          </n-alert>
          <n-space justify="end">
            <n-button secondary @click="settingsVisible = false">取消</n-button>
            <n-button type="primary" attr-type="submit" :loading="conversationStore.saving">
              保存
            </n-button>
          </n-space>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import type { ChatStreamPayload } from '@tavern/shared';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { NSelect, type SelectOption, useDialog, useMessage } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';

import { regenerateMessage, type Message } from '../../api/messages';
import ChatRoom from '../../components/ChatRoom.vue';
import EmptyState from '../../components/EmptyState.vue';
import ShareManager from '../../components/ShareManager.vue';
import { useChatStream } from '../../composables/useChatStream';
import { useTargetEvents } from '../../composables/useTargetEvents';
import { useChatStore } from '../../stores/chat';
import { useConversationStore } from '../../stores/conversation';
import { useCharacterStore } from '../../stores/character';
import { useModelStore } from '../../stores/model';
import { usePersonaStore } from '../../stores/persona';
import { usePresetStore } from '../../stores/preset';

const route = useRoute();
const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const chatStore = useChatStore();
const conversationStore = useConversationStore();
const characterStore = useCharacterStore();
const modelStore = useModelStore();
const personaStore = usePersonaStore();
const presetStore = usePresetStore();
const chatStream = useChatStream();
const settingsVisible = ref(false);
const settingsDrawerWidth = computed(() => Math.min(520, window.innerWidth));
const settingsForm = reactive({
  title: '',
  characterId: '',
  modelFallbackGroupId: null as string | null,
  promptPresetId: null as string | null,
  personaId: null as string | null,
  status: 'active' as 'active' | 'archived'
});
const chatStreamAbortedCode = 'CHAT_STREAM_ABORTED';
let syncTimer: number | null = null;
const targetEvents = useTargetEvents(() => {
  if (chatStore.isGenerating || !conversationId.value) return;
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => reloadMessages(), 80);
});

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
  const modelFallbackGroup = currentConversation.value?.modelFallbackGroup;

  if (modelFallbackGroup) {
    return `${modelFallbackGroup.name} / ${modelFallbackGroup.candidateCount} 个模型`;
  }

  return '未选择';
});
const presetLabel = computed(() => currentConversation.value?.promptPreset?.name ?? '未选择');
const personaLabel = computed(() => currentConversation.value?.persona?.name ?? '未选择');
const hasConversationMessages = computed(() => chatStore.visibleMessages.length > 0);
const characterOptions = computed<SelectOption[]>(() =>
  characterStore.items.map((item) => ({ label: item.name, value: item.id }))
);
const modelOptions = computed<SelectOption[]>(() =>
  modelStore.fallbackGroups
    .filter((item) => item.isEnabled)
    .map((item) => ({ label: item.name, value: item.id }))
);
const presetOptions = computed<SelectOption[]>(() =>
  presetStore.items.map((item) => ({ label: item.name, value: item.id }))
);
const personaOptions = computed<SelectOption[]>(() =>
  personaStore.items.map((item) => ({ label: item.name, value: item.id }))
);
const statusOptions: SelectOption[] = [
  { label: '活跃', value: 'active' },
  { label: '已归档', value: 'archived' }
];

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
    targetEvents.disconnect();
    chatStore.reset();

    return;
  }

  targetEvents.connect('conversation', conversationId.value);

  await Promise.allSettled([
    conversationStore.loadConversation(conversationId.value),
    chatStore.loadMessages(conversationId.value, { page: 1, pageSize: 100, order: 'asc' })
  ]);
}

function reloadMessages() {
  if (!conversationId.value || chatStore.isGenerating) {
    return;
  }

  void chatStore.loadMessages(conversationId.value, { page: 1, pageSize: 100, order: 'asc' });
}

function goConversations() {
  void router.push({ name: 'conversations' });
}

async function openConversationSettings() {
  const conversation = currentConversation.value;
  if (!conversation) return;

  Object.assign(settingsForm, {
    title: conversation.title,
    characterId: conversation.characterId,
    modelFallbackGroupId: conversation.modelFallbackGroupId,
    promptPresetId: conversation.promptPresetId,
    personaId: conversation.personaId,
    status: conversation.status === 'archived' ? 'archived' : 'active'
  });
  conversationStore.saveError = null;
  settingsVisible.value = true;
  await Promise.allSettled([
    characterStore.loadCharacters({ page: 1, pageSize: 100 }),
    modelStore.loadModelResources({ pageSize: 100 }),
    presetStore.loadPresets({ page: 1, pageSize: 100 }),
    personaStore.loadPersonas({ page: 1, pageSize: 100 })
  ]);
}

async function saveConversationSettings() {
  const activeId = conversationId.value;
  if (!activeId || !settingsForm.title.trim() || !settingsForm.characterId) return;

  const updated = await conversationStore.updateConversation(activeId, {
    title: settingsForm.title.trim(),
    characterId: settingsForm.characterId,
    modelFallbackGroupId: settingsForm.modelFallbackGroupId,
    promptPresetId: settingsForm.promptPresetId,
    personaId: settingsForm.personaId,
    status: settingsForm.status
  });

  if (!updated) return;
  settingsVisible.value = false;
  message.success('会话设置已保存');

  if (updated.status === 'archived') {
    await router.push({ name: 'conversations' });
  } else {
    await conversationStore.loadConversation(activeId);
  }
}

function goPromptPreview() {
  if (!conversationId.value) {
    return;
  }

  void router.push({
    name: 'prompt-preview',
    query: {
      conversationId: conversationId.value,
      userInput: chatStore.draft.trim()
    }
  });
}

function goWorldBook() {
  void router.push({ name: 'worldbook' });
}

async function handleSend() {
  const activeConversationId = conversationId.value;
  const userMessage = chatStore.draft.trim();

  if (!activeConversationId || !userMessage || chatStore.isGenerating) {
    return;
  }

  chatStore.beginStreaming(activeConversationId, userMessage);

  await runChatStream(activeConversationId, {
    conversationId: activeConversationId,
    userMessage,
    modelFallbackGroupId: currentConversation.value?.modelFallbackGroupId ?? undefined,
    presetId: currentConversation.value?.promptPresetId ?? undefined
  });
}

async function handleRegenerate(target: Message) {
  const activeConversationId = conversationId.value;

  if (!activeConversationId || chatStore.isGenerating) {
    return;
  }

  if (target.role !== 'assistant') {
    message.warning('只能重新生成角色回复。');

    return;
  }

  try {
    const regenerate = await regenerateMessage(target.id);

    if (regenerate.conversationId !== activeConversationId) {
      message.warning('当前会话已切换，未执行重新生成。');

      return;
    }

    chatStore.beginRegenerateStreaming(activeConversationId, target);
    await runChatStream(activeConversationId, {
      conversationId: activeConversationId,
      regenerateMessageId: regenerate.regenerateMessageId,
      modelFallbackGroupId: currentConversation.value?.modelFallbackGroupId ?? undefined,
      presetId: currentConversation.value?.promptPresetId ?? undefined
    });
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重新生成失败。');
  }
}

async function handleSuggestions() {
  const activeConversationId = conversationId.value;

  if (!activeConversationId || chatStore.isGenerating) {
    return;
  }

  try {
    await chatStore.loadSuggestions({
      conversationId: activeConversationId,
      count: 3,
      modelFallbackGroupId: currentConversation.value?.modelFallbackGroupId ?? undefined,
      presetId: currentConversation.value?.promptPresetId ?? undefined
    });
  } catch (error) {
    message.error(error instanceof Error ? error.message : '生成候选发言失败。');
  }
}

async function handleEdit(payload: {
  message: Message;
  content: string;
  resolve: () => void;
  reject: (error: unknown) => void;
}) {
  if (chatStore.isGenerating) {
    const error = new Error('生成中不能编辑消息。');
    payload.reject(error);
    message.warning(error.message);

    return;
  }

  if (payload.message.role !== 'user') {
    const error = new Error('只能编辑用户消息。');
    payload.reject(error);
    message.warning(error.message);

    return;
  }

  try {
    await chatStore.editMessage(payload.message.id, payload.content);
    payload.resolve();
    message.success('消息已保存');
  } catch (error) {
    payload.reject(error);
    message.error(error instanceof Error ? error.message : '消息保存失败。');
  }
}

function confirmDelete(target: Message) {
  if (chatStore.isGenerating) {
    message.warning('生成中不能删除消息。');

    return;
  }

  dialog.warning({
    title: '删除消息',
    content: '删除后会从当前会话列表移除，不会触发重新生成。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await chatStore.removeMessage(target.id);
        message.success('消息已删除');
      } catch (error) {
        message.error(error instanceof Error ? error.message : '消息删除失败。');
      }
    }
  });
}

async function runChatStream(activeConversationId: string, payload: ChatStreamPayload) {
  let streamFailed = false;
  let streamStopped = false;

  await chatStream.startStream(payload, {
    onDelta: (event) => {
      if (chatStore.conversationId !== activeConversationId) {
        return;
      }

      chatStore.appendStreamingDelta({
        text: event.text,
        messageId: event.messageId
      });
    },
    onDone: (event) => {
      if (chatStore.conversationId !== activeConversationId) {
        return;
      }

      chatStore.completeStreaming(event.messageId);
    },
    onError: (event) => {
      if (chatStore.conversationId !== activeConversationId) {
        return;
      }

      if (event.code === chatStreamAbortedCode) {
        streamStopped = true;
        chatStore.stopStreaming(event.message);

        return;
      }

      streamFailed = true;
      chatStore.failStreaming(event.message);
      message.error(event.message);
    }
  });

  if (chatStore.conversationId !== activeConversationId) {
    return;
  }

  if (!streamFailed && chatStore.isStreaming) {
    chatStore.completeStreaming();
  }

  if (streamStopped) {
    await waitForAbortCleanup();
  }

  await chatStore.loadMessages(activeConversationId, { page: 1, pageSize: 100, order: 'asc' });
  chatStore.clearStreamingMessages();
}

function handleStop() {
  if (!chatStore.requestStopStreaming()) {
    return;
  }

  chatStream.abort();
  message.info('已停止当前生成。');
}

function handleLatestRegeneratePlaceholder() {
  message.info('重新生成最新回复会在后续阶段接入。');
}

async function copyMessage(target: Message) {
  if (!target.content) {
    message.warning('当前消息没有可复制的内容。');

    return;
  }

  try {
    await navigator.clipboard.writeText(target.content);
    message.success('消息已复制');
  } catch {
    message.warning('当前浏览器不允许直接复制，请手动选择文本。');
  }
}

function waitForAbortCleanup() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 250);
  });
}
</script>

<style scoped>
.chat-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  /* 占满 app-content 可用高度：视口高 - app-header(72px) - app-content 上下 padding(48px) */
  height: calc(100vh - 72px - 48px);
  overflow: hidden;
  align-content: stretch;
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
  /* 允许收缩，让内部 chat-room__messages 滚动生效 */
  min-height: 0;
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
  .chat-view {
    /* 小屏：解除固定高度，允许整页滚动，避免 aside 被裁剪 */
    height: auto;
    overflow: visible;
  }

  .chat-view__layout {
    grid-template-columns: 1fr;
  }

  .chat-view__side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .chat-view {
    /* 使用动态视口高度，浏览器地址栏和软键盘变化时保留消息滚动区域。 */
    height: calc(100dvh - 68px);
    gap: 8px;
  }

  .chat-view__header {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .chat-view__header p {
    display: none;
  }

  .chat-view__header h2 {
    font-size: 18px;
  }

  .chat-view__side {
    display: none;
  }
}
</style>
