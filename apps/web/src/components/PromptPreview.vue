<template>
  <section class="prompt-preview">
    <div class="prompt-preview__toolbar" aria-label="Prompt 预览视图">
      <div class="prompt-preview__mode-switch">
        <button
          v-for="option in viewOptions"
          :key="option.value"
          type="button"
          :class="{ 'is-active': viewMode === option.value }"
          @click="viewMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <n-space size="small">
        <n-button size="small" secondary :disabled="!preview" @click="copyFinalMessages">
          复制 messages
        </n-button>
        <n-button size="small" secondary :disabled="!preview" @click="copyPreviewJson">
          复制 JSON
        </n-button>
      </n-space>
    </div>

    <LoadingState v-if="loading" text="正在生成 Prompt 预览" />

    <ErrorState v-else-if="error" title="Prompt 预览失败" :description="error" />

    <EmptyState
      v-else-if="!preview"
      title="暂无预览结果"
      description="选择会话并输入本轮用户消息后，可以查看后端 Prompt Builder 的真实输出。"
    />

    <div v-else class="prompt-preview__content">
      <section class="prompt-preview__summary" aria-label="Prompt 调试摘要">
        <div>
          <span>最终消息</span>
          <strong>{{ preview.finalMessages.length }}</strong>
        </div>
        <div>
          <span>分段</span>
          <strong>{{ preview.sections.length }}</strong>
        </div>
        <div>
          <span>历史裁剪</span>
          <strong>{{ preview.historyTrimInfo.truncatedCount }}</strong>
        </div>
        <div>
          <span>Token 估算</span>
          <strong>{{ preview.tokenEstimate ?? 0 }}</strong>
        </div>
      </section>

      <section v-if="viewMode === 'sections'" class="prompt-preview__grid">
        <article
          v-for="section in preview.sections"
          :key="section.id"
          class="prompt-preview-section"
        >
          <header>
            <div>
              <n-tag size="small" :bordered="false">{{ section.kind }}</n-tag>
              <h3>{{ section.title }}</h3>
            </div>
            <n-button size="tiny" secondary @click="copyText(section.content)">复制</n-button>
          </header>
          <dl>
            <div>
              <dt>来源</dt>
              <dd>{{ section.source }}</dd>
            </div>
            <div>
              <dt>顺序</dt>
              <dd>{{ section.order }}</dd>
            </div>
            <div>
              <dt>估算</dt>
              <dd>{{ section.tokenEstimate ?? 0 }}</dd>
            </div>
          </dl>
          <pre>{{ section.content }}</pre>
        </article>
      </section>

      <section v-else-if="viewMode === 'messages'" class="prompt-preview__messages">
        <article
          v-for="(message, index) in preview.finalMessages"
          :key="`${message.role}-${index}`"
          class="prompt-preview-message"
        >
          <header>
            <div>
              <n-tag size="small" type="info" :bordered="false">{{ message.role }}</n-tag>
              <strong>#{{ index + 1 }}</strong>
            </div>
            <n-button size="tiny" secondary @click="copyText(message.content)">复制</n-button>
          </header>
          <pre>{{ message.content }}</pre>
        </article>
      </section>

      <section v-else class="prompt-preview__json">
        <header>
          <h3>调试 JSON</h3>
          <n-button size="tiny" secondary @click="copyPreviewJson">复制</n-button>
        </header>
        <pre>{{ previewJson }}</pre>
      </section>

      <section class="prompt-preview-debug" aria-label="历史裁剪信息">
        <header>
          <h3>历史裁剪</h3>
          <n-tag size="small" :bordered="false">
            使用 {{ preview.historyTrimInfo.usedHistoryCount }} /
            {{ preview.historyTrimInfo.availableHistoryCount }}
          </n-tag>
        </header>
        <dl>
          <div>
            <dt>请求条数</dt>
            <dd>{{ preview.historyTrimInfo.requestedHistoryLimit }}</dd>
          </div>
          <div>
            <dt>字符上限</dt>
            <dd>{{ preview.historyTrimInfo.requestedMaxHistoryCharacters }}</dd>
          </div>
          <div>
            <dt>裁剪条数</dt>
            <dd>{{ preview.historyTrimInfo.truncatedCount }}</dd>
          </div>
          <div>
            <dt>警告</dt>
            <dd>{{ preview.debug.warnings.length }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage } from 'naive-ui';

import ErrorState from './ErrorState.vue';
import EmptyState from './EmptyState.vue';
import LoadingState from './LoadingState.vue';
import type { PromptPreviewResponse } from '@tavern/shared';

type ViewMode = 'sections' | 'messages' | 'json';

const props = defineProps<{
  preview: PromptPreviewResponse | null;
  loading: boolean;
  error: string | null;
}>();

const message = useMessage();
const viewMode = ref<ViewMode>('sections');
const viewOptions: Array<{ label: string; value: ViewMode }> = [
  { label: '分段', value: 'sections' },
  { label: 'Messages', value: 'messages' },
  { label: 'JSON', value: 'json' }
];
const previewJson = computed(() => JSON.stringify(props.preview, null, 2));

async function copyFinalMessages() {
  if (!props.preview) {
    return;
  }

  await copyText(JSON.stringify(props.preview.finalMessages, null, 2));
}

async function copyPreviewJson() {
  if (!props.preview) {
    return;
  }

  await copyText(previewJson.value);
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    message.success('已复制');
  } catch {
    message.warning('当前浏览器不允许直接复制，请手动选择文本。');
  }
}
</script>

<style scoped>
.prompt-preview {
  display: grid;
  gap: 14px;
}

.prompt-preview__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.prompt-preview__mode-switch {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
}

.prompt-preview__mode-switch button {
  min-height: 34px;
  border: 0;
  border-right: 1px solid var(--line-subtle);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  cursor: pointer;
}

.prompt-preview__mode-switch button:last-child {
  border-right: 0;
}

.prompt-preview__mode-switch button.is-active {
  background: rgba(34, 197, 94, 0.16);
  color: var(--text-strong);
}

.prompt-preview__content,
.prompt-preview__grid,
.prompt-preview__messages {
  display: grid;
  gap: 12px;
}

.prompt-preview__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.prompt-preview__summary div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.prompt-preview__summary span,
.prompt-preview-section dt,
.prompt-preview-debug dt {
  color: var(--text-muted);
  font-size: 12px;
}

.prompt-preview__summary strong {
  color: var(--text-strong);
  font-size: 20px;
}

.prompt-preview-section,
.prompt-preview-message,
.prompt-preview__json,
.prompt-preview-debug {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.prompt-preview-section header,
.prompt-preview-message header,
.prompt-preview__json header,
.prompt-preview-debug header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.prompt-preview-section header div,
.prompt-preview-message header div {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.prompt-preview-section h3,
.prompt-preview__json h3,
.prompt-preview-debug h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
}

.prompt-preview-section dl,
.prompt-preview-debug dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.prompt-preview-section dl div,
.prompt-preview-debug dl div {
  min-width: 0;
}

.prompt-preview-section dd,
.prompt-preview-debug dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--text-strong);
}

.prompt-preview pre {
  overflow: auto;
  max-height: 420px;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: #0b1020;
  color: #dbeafe;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 820px) {
  .prompt-preview__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .prompt-preview__summary,
  .prompt-preview-section dl,
  .prompt-preview-debug dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .prompt-preview__mode-switch,
  .prompt-preview__summary,
  .prompt-preview-section dl,
  .prompt-preview-debug dl {
    grid-template-columns: 1fr;
  }
}
</style>
