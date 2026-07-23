<template>
  <main class="page-shell content-pack-view">
    <header class="page-shell__header content-pack-view__header">
      <div>
        <h2>内容包导入</h2>
        <p>导入 AI 生成的角色、世界书、Persona、Prompt 预设和开局会话，不覆盖现有数据。</p>
      </div>
      <n-tag :bordered="false" type="success">tavern-lite.content-pack.v2</n-tag>
    </header>

    <div class="content-pack-layout">
      <n-card class="page-panel import-panel" :bordered="false">
        <section class="import-section">
          <div class="section-head">
            <h3>内容包 JSON</h3>
            <p>可粘贴 JSON，也可以选择本地 .json 文件。预览不会写入数据库。</p>
          </div>

          <label class="file-field">
            <span>选择 JSON 文件</span>
            <input type="file" accept="application/json,.json" @change="handleFileChange" />
          </label>
          <div v-if="selectedFileName" class="file-name">{{ selectedFileName }}</div>

          <n-input
            v-model:value="rawJson"
            type="textarea"
            placeholder='{ "format": "tavern-lite.content-pack.v2", ... }'
            :autosize="{ minRows: 16, maxRows: 28 }"
          />

          <div class="strategy-row">
            <label>
              <span>同名处理</span>
              <select v-model="duplicateStrategy">
                <option value="reject">发现冲突就阻止导入</option>
                <option value="rename">自动重命名后导入</option>
                <option value="skip">跳过冲突资源</option>
              </select>
            </label>
          </div>

          <div class="action-row">
            <n-button type="primary" :loading="previewing" :disabled="!canSubmit" @click="preview">
              预览内容包
            </n-button>
            <n-button
              type="success"
              :loading="importing"
              :disabled="!canImport"
              @click="commitImport"
            >
              确认导入
            </n-button>
          </div>
        </section>
      </n-card>

      <n-card class="page-panel preview-panel" :bordered="false">
        <section v-if="previewResult" class="preview-section">
          <div class="section-head">
            <h3>{{ previewResult.preview.title }}</h3>
            <p>{{ previewResult.preview.description || '内容包预览已生成。' }}</p>
          </div>

          <div class="summary-grid">
            <article v-for="item in summaryItems" :key="item.label" class="summary-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>

          <n-alert
            v-if="previewResult.preview.conflicts.length > 0"
            class="preview-alert"
            :type="duplicateStrategy === 'reject' ? 'warning' : 'info'"
            :bordered="false"
          >
            检测到 {{ previewResult.preview.conflicts.length }} 个同名冲突，当前策略为
            {{ strategyLabel }}。
          </n-alert>

          <div v-if="previewResult.preview.conflicts.length > 0" class="detail-list">
            <article
              v-for="conflict in previewResult.preview.conflicts"
              :key="`${conflict.type}-${conflict.name}`"
              class="detail-item"
            >
              <span>{{ conflict.type }}</span>
              <strong>{{ conflict.name }}</strong>
              <p>
                {{ conflict.action }}
                <template v-if="conflict.suggestedName"> -> {{ conflict.suggestedName }}</template>
              </p>
            </article>
          </div>

          <div v-if="previewResult.preview.warnings.length > 0" class="detail-list">
            <article
              v-for="warning in previewResult.preview.warnings"
              :key="`${warning.code}-${warning.path ?? warning.message}`"
              class="detail-item"
            >
              <span>{{ warning.code }}</span>
              <strong>{{ warning.path ?? '内容包' }}</strong>
              <p>{{ warning.message }}</p>
            </article>
          </div>

          <n-alert v-if="lastImported" class="preview-alert" type="success" :bordered="false">
            已导入内容包：角色 {{ lastImported.result?.characterIds.length ?? 0 }} 个，世界书
            {{ lastImported.result?.worldBookIds.length ?? 0 }} 个，会话
            {{ lastImported.result?.conversationIds.length ?? 0 }} 个。
          </n-alert>

          <div v-if="lastImported?.result?.conversationIds.length" class="action-row">
            <n-button secondary @click="openFirstConversation">打开首个会话</n-button>
          </div>
        </section>

        <n-result
          v-else
          status="info"
          title="等待预览"
          description="粘贴或选择内容包 JSON 后，先预览资源数量、冲突和告警。"
        />
      </n-card>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { ContentPackDuplicateStrategy, ContentPackImportResponse } from '@tavern/shared';
import { useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { importContentPack } from '../../api/contentPacks';

const message = useMessage();
const router = useRouter();

const rawJson = ref('');
const selectedFileName = ref('');
const duplicateStrategy = ref<ContentPackDuplicateStrategy>('reject');
const previewing = ref(false);
const importing = ref(false);
const previewResult = ref<ContentPackImportResponse | null>(null);
const lastImported = ref<ContentPackImportResponse | null>(null);

const canSubmit = computed(() => rawJson.value.trim().length > 0 && !previewing.value);
const canImport = computed(() => {
  if (!previewResult.value || importing.value) {
    return false;
  }

  return duplicateStrategy.value !== 'reject' || previewResult.value.preview.conflicts.length === 0;
});

const strategyLabel = computed(() => {
  if (duplicateStrategy.value === 'rename') {
    return '自动重命名';
  }

  if (duplicateStrategy.value === 'skip') {
    return '跳过冲突资源';
  }

  return '发现冲突就阻止导入';
});

const summaryItems = computed(() => {
  const summary = previewResult.value?.preview.summary;

  if (!summary) {
    return [];
  }

  return [
    { label: '角色', value: summary.characters },
    { label: 'Persona', value: summary.personas },
    { label: '预设', value: summary.promptPresets },
    { label: '世界书', value: summary.worldBooks },
    { label: '条目', value: summary.worldBookEntries },
    { label: '会话', value: summary.conversations },
    { label: '消息', value: summary.messages },
    { label: '跳过', value: summary.skipped }
  ];
});

watch([rawJson, duplicateStrategy], () => {
  previewResult.value = null;
  lastImported.value = null;
});

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  selectedFileName.value = '';
  previewResult.value = null;
  lastImported.value = null;

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    message.error('请选择 JSON 文件。');
    input.value = '';
    return;
  }

  try {
    rawJson.value = await file.text();
    selectedFileName.value = file.name;
  } catch {
    message.error('读取内容包文件失败。');
    input.value = '';
  }
}

async function preview() {
  if (!canSubmit.value || previewing.value) {
    return;
  }

  previewing.value = true;
  lastImported.value = null;

  try {
    previewResult.value = await importContentPack(rawJson.value, {
      commit: false,
      duplicateStrategy: duplicateStrategy.value
    });
    message.success('内容包预览已生成。');
  } catch (error) {
    previewResult.value = null;
    message.error(error instanceof Error ? error.message : '内容包预览失败。');
  } finally {
    previewing.value = false;
  }
}

async function commitImport() {
  if (!canImport.value || importing.value) {
    return;
  }

  importing.value = true;

  try {
    const result = await importContentPack(rawJson.value, {
      commit: true,
      duplicateStrategy: duplicateStrategy.value
    });

    previewResult.value = result;
    lastImported.value = result;
    message.success('内容包导入完成。');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '内容包导入失败。');
  } finally {
    importing.value = false;
  }
}

function openFirstConversation() {
  const conversationId = lastImported.value?.result?.conversationIds[0];

  if (conversationId) {
    void router.push({ name: 'chat-conversation', params: { conversationId } });
  }
}
</script>

<style scoped>
.content-pack-view__header {
  grid-template-columns: 1fr auto;
  align-items: start;
}

.content-pack-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  gap: 18px;
}

.import-panel,
.preview-panel {
  min-width: 0;
}

.import-section,
.preview-section {
  display: grid;
  gap: 16px;
}

.section-head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.section-head p {
  margin: 6px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.file-field {
  display: grid;
  gap: 8px;
  color: var(--text-strong);
}

.file-field input {
  color: var(--text-muted);
}

.file-name {
  color: var(--text-muted);
  font-size: 13px;
}

.strategy-row label {
  display: grid;
  gap: 8px;
  max-width: 360px;
  color: var(--text-strong);
}

.strategy-row select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-strong);
}

.action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item,
.detail-item {
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.summary-item span,
.detail-item span {
  color: var(--text-muted);
  font-size: 12px;
}

.summary-item strong,
.detail-item strong {
  display: block;
  margin-top: 4px;
  color: var(--text-strong);
  font-size: 15px;
}

.detail-list {
  display: grid;
  gap: 10px;
}

.detail-item p {
  margin: 6px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.preview-alert {
  margin-top: 2px;
}

@media (max-width: 1080px) {
  .content-pack-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .content-pack-view__header {
    display: grid;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
