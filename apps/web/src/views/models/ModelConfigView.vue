<template>
  <main class="page-shell model-config-view">
    <header class="page-shell__header model-config-view__header">
      <div>
        <h2>模型配置</h2>
        <p>管理 OpenAI-compatible 服务地址、模型名和默认生成参数。</p>
      </div>
      <n-button type="primary" @click="openCreate">新建配置</n-button>
    </header>

    <section class="model-config-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索配置、供应商、模型或 Base URL"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState v-if="modelStore.loading" text="正在加载模型配置" />

    <ErrorState
      v-else-if="modelStore.error"
      title="模型配置加载失败"
      :description="modelStore.error"
    />

    <EmptyState
      v-else-if="!modelStore.hasModelConfigs"
      title="还没有模型配置"
      description="新增配置后，后续聊天和 Prompt 预览会使用这里的模型基础信息。"
    />

    <section v-else class="model-config-view__grid" aria-label="模型配置列表">
      <n-card
        v-for="modelConfig in modelStore.items"
        :key="modelConfig.id"
        class="model-config-card"
        :bordered="false"
      >
        <template #header>
          <div class="model-config-card__title">
            <strong>{{ modelConfig.name }}</strong>
            <n-space size="small">
              <n-tag v-if="modelConfig.isDefault" size="small" type="success" :bordered="false">
                默认
              </n-tag>
              <n-tag
                size="small"
                :type="modelConfig.isEnabled ? 'info' : 'warning'"
                :bordered="false"
              >
                {{ modelConfig.isEnabled ? '启用' : '停用' }}
              </n-tag>
            </n-space>
          </div>
        </template>

        <dl class="model-config-card__meta">
          <div>
            <dt>Provider</dt>
            <dd>{{ modelConfig.providerName }}</dd>
          </div>
          <div>
            <dt>Base URL</dt>
            <dd>{{ modelConfig.baseUrl }}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{{ modelConfig.modelName }}</dd>
          </div>
          <div>
            <dt>API Key</dt>
            <dd>{{ modelConfig.apiKeyMask ?? '未保存' }}</dd>
          </div>
        </dl>

        <div class="model-config-card__params">
          <n-tag v-for="item in parameterSummary(modelConfig)" :key="item" size="small">
            {{ item }}
          </n-tag>
        </div>

        <n-alert
          v-if="testResults[modelConfig.id]"
          class="model-config-card__test-result"
          :type="testResults[modelConfig.id].ok ? 'success' : 'error'"
          :bordered="false"
        >
          <div class="model-config-card__test-message">
            <strong>{{ testResults[modelConfig.id].message }}</strong>
            <span>{{ testResultSummary(testResults[modelConfig.id]) }}</span>
          </div>
        </n-alert>

        <template #action>
          <n-space justify="end">
            <n-button
              size="small"
              secondary
              :loading="testingId === modelConfig.id"
              @click="testConnection(modelConfig)"
            >
              测试连接
            </n-button>
            <n-button size="small" secondary @click="openEdit(modelConfig)">编辑</n-button>
            <n-button
              size="small"
              secondary
              type="error"
              :loading="deletingId === modelConfig.id"
              @click="confirmDelete(modelConfig)"
            >
              删除
            </n-button>
          </n-space>
        </template>
      </n-card>
    </section>

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content :title="editingModelConfig ? '编辑模型配置' : '新建模型配置'">
        <ModelConfigForm
          :initial-value="editingModelConfig"
          :submitting="modelStore.saving"
          :submit-label="editingModelConfig ? '保存配置' : '创建配置'"
          :error="modelStore.saveError"
          @submit="handleSubmit"
          @cancel="closeDrawer"
        />
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import {
  testModelConfigConnection,
  type ModelConfig,
  type ModelConfigMutationPayload
} from '../../api/models';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import ModelConfigForm from '../../components/ModelConfigForm.vue';
import { useModelStore } from '../../stores/model';
import type { ModelConfigPayload, ModelConfigTestResponse } from '@tavern/shared';

const modelStore = useModelStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(modelStore.search);
const drawerVisible = ref(false);
const editingModelConfig = ref<ModelConfig | null>(null);
const deletingId = ref<string | null>(null);
const testingId = ref<string | null>(null);
const testResults = ref<Record<string, ModelConfigTestResponse>>({});
const drawerWidth = computed(() => Math.min(720, window.innerWidth));

onMounted(() => {
  void modelStore.loadModelConfigs();
});

function applySearch() {
  modelStore.setSearch(searchText.value);
  void modelStore.loadModelConfigs({
    page: 1,
    search: searchText.value
  });
}

function openCreate() {
  editingModelConfig.value = null;
  modelStore.saveError = null;
  drawerVisible.value = true;
}

function openEdit(modelConfig: ModelConfig) {
  editingModelConfig.value = modelConfig;
  modelStore.saveError = null;
  drawerVisible.value = true;
}

function closeDrawer() {
  drawerVisible.value = false;
}

async function handleSubmit(payload: ModelConfigPayload | ModelConfigMutationPayload) {
  const result = editingModelConfig.value
    ? await modelStore.updateModelConfig(editingModelConfig.value.id, payload)
    : await modelStore.createModelConfig(payload as ModelConfigPayload);

  if (!result) {
    return;
  }

  message.success(editingModelConfig.value ? '模型配置已保存' : '模型配置已创建');
  closeDrawer();
}

function confirmDelete(modelConfig: ModelConfig) {
  dialog.warning({
    title: '删除模型配置',
    content: `确认删除“${modelConfig.name}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deleteModelConfig(modelConfig.id)
  });
}

async function deleteModelConfig(id: string) {
  deletingId.value = id;

  try {
    const deleted = await modelStore.deleteModelConfig(id);

    if (deleted) {
      message.success('模型配置已删除');
    }
  } finally {
    deletingId.value = null;
  }
}

async function testConnection(modelConfig: ModelConfig) {
  testingId.value = modelConfig.id;

  try {
    const result = await testModelConfigConnection(modelConfig.id);

    testResults.value = {
      ...testResults.value,
      [modelConfig.id]: result
    };

    if (result.ok) {
      message.success(`连接测试通过，耗时 ${result.latencyMs}ms`);
    } else {
      message.error(result.message);
    }
  } catch (error) {
    const fallbackResult: ModelConfigTestResponse = {
      ok: false,
      latencyMs: 0,
      providerName: modelConfig.providerName,
      modelName: modelConfig.modelName,
      baseUrl: modelConfig.baseUrl,
      statusCode: null,
      message: error instanceof Error ? error.message : '连接测试失败。',
      summary: null,
      testedAt: new Date().toISOString()
    };

    testResults.value = {
      ...testResults.value,
      [modelConfig.id]: fallbackResult
    };
    message.error(fallbackResult.message);
  } finally {
    testingId.value = null;
  }
}

function testResultSummary(result: ModelConfigTestResponse): string {
  const status = result.statusCode === null ? '无 HTTP 状态' : `HTTP ${result.statusCode}`;
  const summary = result.summary ? `，${result.summary}` : '';

  return `${status}，耗时 ${result.latencyMs}ms${summary}`;
}

function parameterSummary(modelConfig: ModelConfig): string[] {
  const items = [
    modelConfig.temperature === null ? null : `temp ${modelConfig.temperature}`,
    modelConfig.topP === null ? null : `topP ${modelConfig.topP}`,
    modelConfig.maxTokens === null ? null : `max ${modelConfig.maxTokens}`,
    modelConfig.timeout === null ? null : `${modelConfig.timeout}ms`
  ].filter(Boolean) as string[];

  return items.length > 0 ? items : ['未设置生成参数'];
}
</script>

<style scoped>
.model-config-view {
  align-content: start;
}

.model-config-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.model-config-view__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 480px) auto;
  gap: 10px;
  align-items: center;
}

.model-config-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.model-config-card {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.model-config-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.model-config-card__title strong {
  overflow: hidden;
  min-width: 0;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-config-card__meta {
  display: grid;
  gap: 10px;
  margin: 0;
}

.model-config-card__meta div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.model-config-card__meta dt {
  color: var(--text-muted);
  font-size: 12px;
}

.model-config-card__meta dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--text-strong);
  line-height: 1.5;
}

.model-config-card__params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.model-config-card__test-result {
  margin-top: 14px;
}

.model-config-card__test-message {
  display: grid;
  gap: 4px;
}

.model-config-card__test-message span {
  overflow-wrap: anywhere;
  font-size: 12px;
}

@media (max-width: 720px) {
  .model-config-view__header,
  .model-config-view__toolbar {
    grid-template-columns: 1fr;
  }

  .model-config-view__grid {
    grid-template-columns: 1fr;
  }
}
</style>
