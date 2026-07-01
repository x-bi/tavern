<template>
  <main class="page-shell prompt-preview-view">
    <header class="page-shell__header prompt-preview-view__header">
      <div>
        <h2>Prompt 预览</h2>
        <p>查看后端 Prompt Builder 生成的分段、最终 messages 和基础调试信息。</p>
      </div>
      <n-button secondary @click="reloadConversations">刷新会话</n-button>
    </header>

    <n-card class="page-panel prompt-preview-view__form" :bordered="false">
      <div class="prompt-preview-view__controls">
        <label>
          <span>会话</span>
          <select v-model="selectedConversationId">
            <option value="">选择会话</option>
            <option
              v-for="conversation in conversationStore.items"
              :key="conversation.id"
              :value="conversation.id"
            >
              {{ conversation.title }} / {{ conversation.character.name }}
            </option>
          </select>
        </label>

        <label>
          <span>历史条数</span>
          <input v-model.number="historyLimit" min="0" max="100" type="number" />
        </label>

        <label>
          <span>历史字符上限</span>
          <input v-model.number="maxHistoryCharacters" min="0" max="50000" type="number" />
        </label>
      </div>

      <label class="prompt-preview-view__input">
        <span>本轮用户输入</span>
        <n-input
          v-model:value="userInput"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          placeholder="输入要预览的用户消息"
        />
      </label>

      <n-alert
        v-if="selectedConversation"
        type="info"
        :bordered="false"
        class="prompt-preview-view__context"
      >
        <div class="prompt-preview-view__context-grid">
          <span>角色：{{ selectedConversation.character.name }}</span>
          <span>模型：{{ modelLabel }}</span>
          <span>预设：{{ selectedConversation.promptPreset?.name ?? '未选择' }}</span>
          <span>Persona：{{ selectedConversation.persona?.name ?? '未选择' }}</span>
        </div>
      </n-alert>

      <div class="prompt-preview-view__actions">
        <n-button
          type="primary"
          :loading="promptStore.loading"
          :disabled="!canPreview"
          @click="generatePreview"
        >
          生成预览
        </n-button>
        <n-button secondary :disabled="!promptStore.preview" @click="promptStore.reset()">
          清空结果
        </n-button>
      </div>
    </n-card>

    <PromptPreview
      :preview="promptStore.preview"
      :loading="promptStore.loading"
      :error="promptStore.error"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';

import PromptPreview from '../../components/PromptPreview.vue';
import { useConversationStore } from '../../stores/conversation';
import { usePromptStore } from '../../stores/prompt';

const conversationStore = useConversationStore();
const promptStore = usePromptStore();
const message = useMessage();
const selectedConversationId = ref('');
const userInput = ref('');
const historyLimit = ref(20);
const maxHistoryCharacters = ref(12000);

const selectedConversation = computed(() => {
  return (
    conversationStore.items.find(
      (conversation) => conversation.id === selectedConversationId.value
    ) ?? null
  );
});
const modelLabel = computed(() => {
  const modelConfig = selectedConversation.value?.modelConfig;

  return modelConfig ? `${modelConfig.name} / ${modelConfig.modelName}` : '未选择';
});
const canPreview = computed(() => {
  return selectedConversationId.value.length > 0 && userInput.value.trim().length > 0;
});

onMounted(async () => {
  await conversationStore.loadConversations({ page: 1, pageSize: 100, status: 'active' });

  if (!selectedConversationId.value && conversationStore.items[0]) {
    selectedConversationId.value = conversationStore.items[0].id;
  }
});

watch(selectedConversationId, () => {
  promptStore.reset();
});

function reloadConversations() {
  void conversationStore.loadConversations({ page: 1, pageSize: 100, status: 'active' });
}

async function generatePreview() {
  if (!canPreview.value) {
    message.warning('请选择会话并输入本轮用户消息。');

    return;
  }

  const result = await promptStore.loadPreview({
    conversationId: selectedConversationId.value,
    userInput: userInput.value.trim(),
    historyLimit: historyLimit.value,
    maxHistoryCharacters: maxHistoryCharacters.value
  });

  if (result) {
    message.success('Prompt 预览已生成');
  }
}
</script>

<style scoped>
.prompt-preview-view {
  align-content: start;
}

.prompt-preview-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.prompt-preview-view__form {
  display: grid;
  gap: 14px;
}

.prompt-preview-view__controls {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(120px, 160px) minmax(150px, 190px);
  gap: 12px;
  align-items: end;
}

.prompt-preview-view__controls label,
.prompt-preview-view__input {
  display: grid;
  gap: 6px;
}

.prompt-preview-view__controls span,
.prompt-preview-view__input span {
  color: var(--text-muted);
  font-size: 12px;
}

.prompt-preview-view__controls select,
.prompt-preview-view__controls input {
  width: 100%;
  min-height: 34px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-strong);
  padding: 0 10px;
}

.prompt-preview-view__controls select option {
  color: #111827;
}

.prompt-preview-view__context {
  overflow: hidden;
}

.prompt-preview-view__context-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.prompt-preview-view__context-grid span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-preview-view__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 980px) {
  .prompt-preview-view__controls,
  .prompt-preview-view__context-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .prompt-preview-view__header,
  .prompt-preview-view__controls,
  .prompt-preview-view__context-grid {
    grid-template-columns: 1fr;
  }

  .prompt-preview-view__actions {
    flex-direction: column;
  }
}
</style>
