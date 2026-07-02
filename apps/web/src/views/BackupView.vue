<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>备份导入导出</h2>
      <p>导出当前用户的应用级逻辑 JSON 备份，供本机归档或后续恢复导入使用。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <section class="backup-export">
        <div class="backup-export__content">
          <h3>应用数据导出</h3>
          <p>
            导出角色、会话、消息、世界书、模型配置、预设、Persona、设置和资源文件清单。 API Key
            只保留掩码与是否存在，不导出明文或密文。
          </p>
          <div class="backup-export__tags">
            <n-tag :bordered="false" type="info">格式版本 tavern-lite.backup.v1</n-tag>
            <n-tag :bordered="false" type="warning">不包含 uploads 文件二进制</n-tag>
          </div>
        </div>
        <n-button type="primary" :loading="exporting" @click="handleExport">
          导出备份 JSON
        </n-button>
      </section>

      <n-alert class="backup-note" type="default" :bordered="false">
        导出的 JSON 是逻辑备份，不是 SQLite 文件快照。头像等上传资源会记录清单和相对路径，
        需要完整恢复时应另行备份 uploads 目录。
      </n-alert>

      <section class="backup-import">
        <div class="backup-import__content">
          <h3>从备份恢复</h3>
          <p>恢复会全量覆盖当前用户现有数据，不做逐条冲突合并。导入前建议先导出一份当前备份。</p>
          <n-alert type="warning" :bordered="false">
            模型 API Key 不会从备份恢复；原来带密钥的模型配置导入后会被禁用，需要重新填写密钥。
          </n-alert>
          <label class="backup-file">
            <span>备份 JSON 文件</span>
            <input type="file" accept="application/json,.json" @change="handleFileChange" />
          </label>
          <n-checkbox v-model:checked="confirmOverwrite">
            我确认使用该备份全量覆盖当前用户数据
          </n-checkbox>
          <div v-if="selectedFileName" class="backup-file__name">{{ selectedFileName }}</div>
          <n-button
            type="warning"
            :loading="importing"
            :disabled="!rawImportJson || !confirmOverwrite"
            @click="handleImport"
          >
            导入并覆盖
          </n-button>
        </div>
      </section>

      <n-alert v-if="lastImportResult" class="backup-note" type="success" :bordered="false">
        已恢复备份 {{ lastImportResult.sourceExportedAt }}：角色
        {{ lastImportResult.summary.characters }} 个，会话
        {{ lastImportResult.summary.conversations }} 个，消息
        {{ lastImportResult.summary.messages }} 条，世界书
        {{ lastImportResult.summary.worldBooks }} 个。模型密钥丢弃
        {{ lastImportResult.summary.apiKeysDropped }} 个，脱敏设置跳过
        {{ lastImportResult.summary.skippedRedactedSettings }} 个。
      </n-alert>
    </n-card>
  </main>
</template>

<script setup lang="ts">
import type { ApplicationBackupImportResponse } from '@tavern/shared';
import { useMessage } from 'naive-ui';
import { ref } from 'vue';

import { exportApplicationBackup, importApplicationBackup } from '../api/backups';

const message = useMessage();
const exporting = ref(false);
const importing = ref(false);
const confirmOverwrite = ref(false);
const rawImportJson = ref('');
const selectedFileName = ref('');
const lastImportResult = ref<ApplicationBackupImportResponse | null>(null);

async function handleExport() {
  if (exporting.value) {
    return;
  }

  exporting.value = true;

  try {
    const download = await exportApplicationBackup();
    const url = URL.createObjectURL(download.blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = download.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    message.success('备份 JSON 已开始下载。');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '备份导出失败。');
  } finally {
    exporting.value = false;
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  rawImportJson.value = '';
  selectedFileName.value = '';
  lastImportResult.value = null;

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    message.error('请选择 JSON 备份文件。');
    input.value = '';
    return;
  }

  try {
    rawImportJson.value = await file.text();
    selectedFileName.value = file.name;
  } catch {
    message.error('读取备份文件失败。');
    input.value = '';
  }
}

async function handleImport() {
  if (!rawImportJson.value || !confirmOverwrite.value || importing.value) {
    return;
  }

  importing.value = true;

  try {
    const result = await importApplicationBackup(rawImportJson.value, confirmOverwrite.value);

    lastImportResult.value = result;
    message.success('备份恢复完成。');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '备份恢复失败。');
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.backup-export {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.backup-export__content {
  display: grid;
  gap: 10px;
  max-width: 760px;
}

.backup-export h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.backup-export p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.backup-export__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.backup-note {
  margin-top: 18px;
}

.backup-import {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--line-subtle);
}

.backup-import__content {
  display: grid;
  gap: 12px;
  max-width: 820px;
}

.backup-import h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.backup-import p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.backup-file {
  display: grid;
  gap: 8px;
  color: var(--text-strong);
}

.backup-file input {
  color: var(--text-muted);
}

.backup-file__name {
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 720px) {
  .backup-export {
    display: grid;
  }
}
</style>
