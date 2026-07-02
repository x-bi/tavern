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
          <span>世界书命中</span>
          <strong>{{ worldBookDebug.matchedCount }}</strong>
        </div>
        <div>
          <span>Token 估算</span>
          <strong>{{ preview.tokenEstimate ?? 0 }}</strong>
        </div>
      </section>

      <section class="prompt-preview-worldbook" aria-label="世界书命中调试">
        <header>
          <div>
            <h3>世界书命中</h3>
            <p>展示 Prompt Builder 已插入的世界书条目和预算使用情况。</p>
          </div>
          <n-tag size="small" :bordered="false">
            {{ worldBookDebug.usedTokenEstimate }} / {{ worldBookDebug.tokenBudget }} tokens
          </n-tag>
        </header>

        <dl class="prompt-preview-worldbook__stats">
          <div>
            <dt>扫描深度</dt>
            <dd>{{ worldBookDebug.scanDepth }}</dd>
          </div>
          <div>
            <dt>扫描消息</dt>
            <dd>{{ worldBookDebug.scannedMessageIds.length }}</dd>
          </div>
          <div>
            <dt>命中条目</dt>
            <dd>{{ worldBookDebug.matchedCount }}</dd>
          </div>
          <div>
            <dt>跳过条目</dt>
            <dd>{{ worldBookDebug.skippedCount }}</dd>
          </div>
        </dl>

        <div v-if="matchedWorldBookEntries.length > 0" class="prompt-preview-worldbook__list">
          <article
            v-for="entry in matchedWorldBookEntries"
            :key="entry.entryId"
            class="prompt-preview-worldbook-entry"
          >
            <header>
              <div>
                <n-tag size="small" type="success" :bordered="false">
                  {{ insertionOrderLabel(entry.insertionOrder) }}
                </n-tag>
                <h4>{{ entry.title }}</h4>
              </div>
              <span>#{{ sectionOrderByEntryId.get(entry.entryId) ?? '-' }}</span>
            </header>
            <dl>
              <div>
                <dt>世界书</dt>
                <dd>{{ entry.worldBookName }}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{{ entry.priority }}</dd>
              </div>
              <div>
                <dt>命中关键词</dt>
                <dd>{{ formatKeywords(entry.matchedKeywords) }}</dd>
              </div>
              <div>
                <dt>预算</dt>
                <dd>{{ entry.tokenEstimate ?? 0 }} / {{ entry.tokenBudget ?? '全局' }}</dd>
              </div>
            </dl>
            <p>{{ contentSummary(entry.content) }}</p>
          </article>
        </div>

        <div v-else class="prompt-preview-worldbook__empty">
          当前输入和扫描范围内的历史消息没有命中世界书条目，Prompt 中不会插入 worldbook 分段。
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
const worldBookDebug = computed(() => {
  return (
    props.preview?.worldBookDebug ?? {
      scanDepth: 0,
      tokenBudget: 0,
      usedTokenEstimate: 0,
      scannedMessageIds: [],
      matchedCount: 0,
      skippedCount: 0,
      matchedEntries: [],
      skippedEntries: [],
      insertedSections: []
    }
  );
});
const matchedWorldBookEntries = computed(() => worldBookDebug.value.matchedEntries);
const sectionOrderByEntryId = computed(() => {
  return new Map(
    worldBookDebug.value.insertedSections
      .filter((section) => section.entryId)
      .map((section) => [section.entryId as string, section.order])
  );
});

function formatKeywords(keywords: string[]) {
  return keywords.length > 0 ? keywords.join('、') : '-';
}

function insertionOrderLabel(value: string) {
  const labels: Record<string, string> = {
    before_history: '历史前',
    after_history: '历史后',
    before_current_user_input: '本轮前',
    after_current_user_input: '本轮后'
  };

  return labels[value] ?? value;
}

function contentSummary(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
.prompt-preview-debug dt,
.prompt-preview-worldbook dt,
.prompt-preview-worldbook-entry dt {
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
.prompt-preview-debug,
.prompt-preview-worldbook {
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
.prompt-preview-debug header,
.prompt-preview-worldbook header,
.prompt-preview-worldbook-entry header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.prompt-preview-section header div,
.prompt-preview-message header div,
.prompt-preview-worldbook header div,
.prompt-preview-worldbook-entry header div {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.prompt-preview-section h3,
.prompt-preview__json h3,
.prompt-preview-debug h3,
.prompt-preview-worldbook h3,
.prompt-preview-worldbook-entry h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
}

.prompt-preview-worldbook header div {
  display: grid;
  gap: 2px;
}

.prompt-preview-worldbook header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.prompt-preview-section dl,
.prompt-preview-debug dl,
.prompt-preview-worldbook__stats,
.prompt-preview-worldbook-entry dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.prompt-preview-section dl div,
.prompt-preview-debug dl div,
.prompt-preview-worldbook dl div,
.prompt-preview-worldbook-entry dl div {
  min-width: 0;
}

.prompt-preview-section dd,
.prompt-preview-debug dd,
.prompt-preview-worldbook dd,
.prompt-preview-worldbook-entry dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--text-strong);
}

.prompt-preview-worldbook__list {
  display: grid;
  gap: 10px;
}

.prompt-preview-worldbook-entry {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.prompt-preview-worldbook-entry header > span {
  color: var(--text-muted);
  font-size: 12px;
}

.prompt-preview-worldbook-entry p,
.prompt-preview-worldbook__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.prompt-preview-worldbook__empty {
  padding: 12px;
  border: 1px dashed var(--line-subtle);
  border-radius: 8px;
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
  .prompt-preview-debug dl,
  .prompt-preview-worldbook__stats,
  .prompt-preview-worldbook-entry dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .prompt-preview__mode-switch,
  .prompt-preview__summary,
  .prompt-preview-section dl,
  .prompt-preview-debug dl,
  .prompt-preview-worldbook__stats,
  .prompt-preview-worldbook-entry dl {
    grid-template-columns: 1fr;
  }
}
</style>
