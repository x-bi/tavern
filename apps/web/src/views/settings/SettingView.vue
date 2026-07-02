<template>
  <main class="page-shell setting-view">
    <header class="page-shell__header setting-view__header">
      <div>
        <h2>设置</h2>
        <p>集中管理应用基础偏好、默认项摘要和备份入口。</p>
      </div>
      <n-button secondary :loading="refreshing" @click="refreshAll">刷新状态</n-button>
    </header>

    <n-card class="page-panel setting-panel" :bordered="false">
      <section class="setting-section">
        <div class="setting-section__head">
          <div>
            <h3>基础应用设置</h3>
            <p>这里只保留 MVP 需要的轻量偏好，不包含主题编辑器或权限配置。</p>
          </div>
          <n-tag
            size="small"
            :bordered="false"
            :type="settingStore.source === 'api' ? 'success' : 'info'"
          >
            {{ settingStore.source === 'api' ? '后端设置' : '本地偏好' }}
          </n-tag>
        </div>

        <n-alert v-if="settingStore.error" class="setting-alert" type="warning" :bordered="false">
          {{ settingStore.error }} 已使用本地偏好作为回退。
        </n-alert>

        <div class="setting-form">
          <n-form-item label="工作台名称">
            <n-input v-model:value="form.workspaceName" maxlength="32" placeholder="Tavern Lite" />
          </n-form-item>
          <n-form-item label="默认历史条数">
            <n-input-number v-model:value="form.defaultHistoryLimit" :min="5" :max="100" />
          </n-form-item>
          <div class="setting-checks">
            <n-checkbox v-model:checked="form.autoOpenLastConversation">
              进入聊天页时优先打开最近会话
            </n-checkbox>
            <n-checkbox v-model:checked="form.compactListMode">
              管理列表使用紧凑显示
            </n-checkbox>
          </div>
          <div class="setting-actions">
            <n-button type="primary" :loading="settingStore.saving" @click="saveSettings">
              保存设置
            </n-button>
            <n-alert v-if="settingStore.saveError" type="error" :bordered="false">
              {{ settingStore.saveError }}
            </n-alert>
          </div>
        </div>
      </section>

      <section class="setting-section">
        <div class="setting-section__head">
          <div>
            <h3>默认项摘要</h3>
            <p>默认模型、Persona 和预设仍在各自管理页维护，这里只做摘要和入口。</p>
          </div>
        </div>

        <div class="summary-grid">
          <article class="summary-item">
            <div>
              <span>默认模型</span>
              <strong>{{ defaultModel?.name ?? '未设置' }}</strong>
              <p>{{ defaultModelSummary }}</p>
            </div>
            <n-button size="small" secondary @click="goTo('models')">管理模型</n-button>
          </article>
          <article class="summary-item">
            <div>
              <span>默认 Persona</span>
              <strong>{{ defaultPersona?.name ?? '未设置' }}</strong>
              <p>{{ defaultPersonaSummary }}</p>
            </div>
            <n-button size="small" secondary @click="goTo('persona')">管理 Persona</n-button>
          </article>
          <article class="summary-item">
            <div>
              <span>默认预设</span>
              <strong>{{ defaultPreset?.name ?? '未设置' }}</strong>
              <p>{{ defaultPresetSummary }}</p>
            </div>
            <n-button size="small" secondary @click="goTo('presets')">管理预设</n-button>
          </article>
        </div>

        <n-alert v-if="summaryError" class="setting-alert" type="warning" :bordered="false">
          {{ summaryError }}
        </n-alert>
      </section>

      <section class="setting-section">
        <div class="setting-section__head">
          <div>
            <h3>备份与恢复</h3>
            <p>导出当前逻辑备份，或进入备份页执行覆盖导入。</p>
          </div>
          <n-tag size="small" type="warning" :bordered="false">不导出 API Key 明文</n-tag>
        </div>

        <div class="backup-entry">
          <div>
            <strong>应用备份 JSON</strong>
            <p>包含角色、会话、消息、世界书、模型配置、预设、Persona、设置和资源清单。</p>
          </div>
          <div class="backup-entry__actions">
            <n-button type="primary" :loading="exporting" @click="exportBackup">
              导出备份
            </n-button>
            <n-button secondary @click="goTo('backup')">导入备份</n-button>
          </div>
        </div>
      </section>
    </n-card>
  </main>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { exportApplicationBackup } from '../../api/backups';
import { useModelStore } from '../../stores/model';
import { usePersonaStore } from '../../stores/persona';
import { usePresetStore } from '../../stores/preset';
import { useSettingStore } from '../../stores/setting';

const message = useMessage();
const router = useRouter();
const settingStore = useSettingStore();
const modelStore = useModelStore();
const personaStore = usePersonaStore();
const presetStore = usePresetStore();

const form = reactive({
  workspaceName: '',
  autoOpenLastConversation: true,
  compactListMode: false,
  defaultHistoryLimit: 20
});

const refreshing = computed(
  () => settingStore.loading || modelStore.loading || personaStore.loading || presetStore.loading
);
const exporting = ref(false);

const defaultModel = computed(() => modelStore.items.find((item) => item.isDefault) ?? null);
const defaultPersona = computed(() => personaStore.items.find((item) => item.isDefault) ?? null);
const defaultPreset = computed(() => presetStore.items.find((item) => item.isDefault) ?? null);

const defaultModelSummary = computed(() => {
  if (!defaultModel.value) {
    return '聊天前建议先设置一个默认模型。';
  }

  return `${defaultModel.value.providerName} / ${defaultModel.value.modelName}`;
});

const defaultPersonaSummary = computed(() => {
  if (!defaultPersona.value) {
    return '新会话不会自动带入 Persona。';
  }

  return trimSummary(defaultPersona.value.content, '已配置默认 Persona。');
});

const defaultPresetSummary = computed(() => {
  if (!defaultPreset.value) {
    return '聊天参数会使用接口默认值。';
  }

  return defaultPreset.value.description || '已配置默认参数预设。';
});

const summaryError = computed(() => {
  const errors = [modelStore.error, personaStore.error, presetStore.error].filter(Boolean);

  return errors.length > 0 ? errors.join(' ') : '';
});

watch(
  () => settingStore.data,
  (settings) => {
    form.workspaceName = settings.workspaceName;
    form.autoOpenLastConversation = settings.autoOpenLastConversation;
    form.compactListMode = settings.compactListMode;
    form.defaultHistoryLimit = settings.defaultHistoryLimit;
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  void refreshAll();
});

async function refreshAll() {
  await Promise.allSettled([
    settingStore.loadSettings(),
    modelStore.loadModelConfigs({ page: 1, pageSize: 100, search: '' }),
    personaStore.loadPersonas({ page: 1, pageSize: 100, search: '' }),
    presetStore.loadPresets({ page: 1, pageSize: 100, search: '' })
  ]);
}

async function saveSettings() {
  const saved = await settingStore.saveSettings({
    workspaceName: form.workspaceName,
    autoOpenLastConversation: form.autoOpenLastConversation,
    compactListMode: form.compactListMode,
    defaultHistoryLimit: form.defaultHistoryLimit
  });

  if (saved) {
    message.success('设置已保存。');
  } else if (settingStore.saveError) {
    message.error(settingStore.saveError);
  }
}

async function exportBackup() {
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

function goTo(name: 'models' | 'persona' | 'presets' | 'backup') {
  void router.push({ name });
}

function trimSummary(value: string, fallback: string): string {
  const text = value.trim().replace(/\s+/g, ' ');

  if (!text) {
    return fallback;
  }

  return text.length > 52 ? `${text.slice(0, 52)}...` : text;
}
</script>

<style scoped>
.setting-view__header {
  grid-template-columns: 1fr auto;
  align-items: start;
}

.setting-panel {
  display: grid;
  gap: 26px;
}

.setting-section {
  display: grid;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--line-subtle);
}

.setting-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.setting-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.setting-section__head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.setting-section__head p,
.summary-item p,
.backup-entry p {
  margin: 6px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.setting-alert {
  max-width: 900px;
}

.setting-form {
  display: grid;
  max-width: 760px;
}

.setting-checks {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}

.setting-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-item {
  display: grid;
  align-content: space-between;
  gap: 18px;
  min-height: 164px;
  padding: 16px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.summary-item span {
  color: var(--text-muted);
  font-size: 13px;
}

.summary-item strong,
.backup-entry strong {
  display: block;
  margin-top: 6px;
  color: var(--text-strong);
  font-size: 16px;
}

.backup-entry {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.backup-entry__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .setting-view__header,
  .setting-section__head,
  .backup-entry {
    display: grid;
  }
}
</style>
