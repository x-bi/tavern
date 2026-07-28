<template>
  <main class="page-shell ai-import-view">
    <header class="page-shell__header">
      <div>
        <h2>AI 智能导入</h2>
        <p>让选定模型链理解、整理并转换内容；校验通过后仍由目标模块原导入能力落库。</p>
      </div>
    </header>

    <n-alert type="warning" :bordered="false">
      原始内容会发送到当前模型链配置的外部模型服务。请勿提交密钥或不希望发送给供应商的私人内容。
    </n-alert>

    <n-card class="page-panel" :bordered="false">
      <n-form label-placement="top">
        <div class="form-grid">
          <n-form-item label="目标模块" required>
            <n-select
              :value="target"
              :options="targetOptions"
              :disabled="processing"
              @update:value="changeTarget"
            />
          </n-form-item>
          <n-form-item label="模型链" required>
            <n-select
              v-model:value="modelFallbackGroupId"
              :options="modelGroupOptions"
              :loading="loadingModels"
              placeholder="请选择模型链"
              filterable
            />
          </n-form-item>
        </div>

        <n-form-item label="原始内容" required>
          <div class="source-field">
            <n-input
              v-model:value="sourceText"
              type="textarea"
              :autosize="{ minRows: 10, maxRows: 24 }"
              placeholder="粘贴自然语言、JSON 或 Markdown，或选择文件后继续编辑"
              @update:value="markSourceEdited"
            />
            <div class="source-meta">
              <span :class="{ 'limit-error': sourceTooLong }">
                {{ sourceText.length }} / {{ options?.limits.sourceMaxChars ?? '—' }} 字符
              </span>
              <div>
                <input
                  ref="fileInput"
                  class="hidden-file"
                  type="file"
                  accept=".json,.txt,.md,application/json,text/plain,text/markdown"
                  @change="selectFile"
                />
                <n-button size="small" @click="fileInput?.click()">选择文件</n-button>
                <n-button size="small" quaternary @click="clearSource">清空</n-button>
              </div>
            </div>
            <n-text v-if="selectedFile" depth="3">
              已选择 {{ selectedFile.name }}（{{ selectedFile.size }} bytes）；
              {{
                sourceEdited
                  ? '内容已编辑，将按文本提交。'
                  : '将按文件接口提交并由后端严格校验 UTF-8。'
              }}
            </n-text>
          </div>
        </n-form-item>

        <n-form-item label="处理方式" required>
          <n-radio-group :value="mode" @update:value="changeMode">
            <div class="mode-grid">
              <n-radio-button
                v-for="item in options?.modes ?? []"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </n-radio-button>
            </div>
          </n-radio-group>
          <n-text depth="3">{{ currentModeDescription }}</n-text>
        </n-form-item>

        <div class="strategy-grid">
          <n-form-item label="通用处理策略">
            <n-checkbox-group v-model:value="generalStrategyIds">
              <div class="strategy-list">
                <n-checkbox
                  v-for="item in options?.generalStrategies ?? []"
                  :key="item.id"
                  :value="item.id"
                  :disabled="item.disabled"
                >
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.description }}</span>
                </n-checkbox>
              </div>
            </n-checkbox-group>
          </n-form-item>
          <n-form-item label="模块专项策略">
            <n-checkbox-group v-model:value="moduleStrategyIds">
              <div class="strategy-list">
                <n-checkbox
                  v-for="item in options?.moduleStrategies ?? []"
                  :key="item.id"
                  :value="item.id"
                  :disabled="item.disabled"
                >
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.description }}</span>
                </n-checkbox>
              </div>
            </n-checkbox-group>
          </n-form-item>
        </div>

        <n-form-item label="其他补充说明">
          <n-input
            v-model:value="customInstructions"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="例如：不要修改角色姓名；人物名称不能作为唯一触发词。"
          />
          <n-text depth="3" :class="{ 'limit-error': customInstructionsTooLong }">
            {{ customInstructions.length }} /
            {{ options?.limits.customInstructionsMaxChars ?? '—' }} 字符
          </n-text>
        </n-form-item>

        <div class="actions">
          <n-button type="primary" :loading="processing" :disabled="!canProcess" @click="process">
            开始 AI 处理
          </n-button>
          <n-button v-if="processing" @click="cancelProcessing">取消</n-button>
        </div>
      </n-form>
    </n-card>

    <n-card v-if="result" class="page-panel result-panel" :bordered="false">
      <div class="result-header">
        <div>
          <h3>处理结果</h3>
          <n-tag :type="result.valid ? 'success' : 'error'">
            {{ result.valid ? '确定性校验通过' : '需要修正 JSON' }}
          </n-tag>
          <n-tag v-if="result.repairAttempted" type="warning">已自动修复一次</n-tag>
        </div>
        <n-text v-if="result.model" depth="3">
          {{ result.model.providerName }} / {{ result.model.modelName }}
        </n-text>
      </div>

      <n-alert
        v-for="warning in result.warnings"
        :key="`${warning.code}-${warning.message}`"
        class="result-alert"
        type="warning"
        :bordered="false"
      >
        {{ warning.message }}
      </n-alert>
      <n-alert
        v-for="error in result.errors"
        :key="`${error.code}-${error.message}`"
        class="result-alert"
        type="error"
        :bordered="false"
      >
        {{ error.code }}：{{ error.message }}
      </n-alert>

      <n-tabs v-model:value="activeTab" type="line">
        <n-tab-pane name="preview" tab="内容预览">
          <pre class="json-preview">{{
            JSON.stringify(result.preview ?? result.result, null, 2)
          }}</pre>
        </n-tab-pane>
        <n-tab-pane name="decisions" tab="AI 判断说明">
          <n-alert type="info" :bordered="false">
            以下是模型生成的解释性信息，不表示后端已证明其事实来源。
          </n-alert>
          <n-data-table
            :columns="decisionColumns"
            :data="result.decisions"
            :pagination="{ pageSize: 10 }"
            :bordered="false"
          />
        </n-tab-pane>
        <n-tab-pane name="json" tab="JSON">
          <n-input
            v-model:value="editableJson"
            type="textarea"
            :autosize="{ minRows: 18, maxRows: 34 }"
            @update:value="markJsonEdited"
          />
          <div class="json-actions">
            <n-button :loading="validatingJson" @click="validateEditedJson">
              重新校验 JSON
            </n-button>
            <n-button @click="copyJson">复制</n-button>
          </div>
        </n-tab-pane>
      </n-tabs>

      <div class="commit-row">
        <n-select
          v-model:value="duplicateNameStrategy"
          class="duplicate-select"
          :options="duplicateOptions"
        />
        <n-button
          type="primary"
          :loading="importing"
          :disabled="!result.valid || jsonDirty"
          @click="confirmImport"
        >
          确认导入
        </n-button>
      </div>
    </n-card>
  </main>
</template>

<script setup lang="ts">
import type {
  AiImportMode,
  AiImportOptionsResponse,
  AiImportTarget,
  AiImportTransformResult,
  ModuleImportDuplicateNameStrategy
} from '@tavern/shared';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import { useMessage } from 'naive-ui';
import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  commitAiImport,
  fetchAiImportOptions,
  transformAiImport,
  transformAiImportFile,
  validateAiImportJson
} from '../../api/aiImports';
import { fetchModelFallbackGroups } from '../../api/models';

const message = useMessage();
const router = useRouter();
const target = ref<AiImportTarget>('character');
const mode = ref<AiImportMode>('smart_optimize');
const options = ref<AiImportOptionsResponse | null>(null);
const modelFallbackGroupId = ref<string | null>(null);
const modelGroupOptions = ref<SelectOption[]>([]);
const loadingModels = ref(false);
const sourceText = ref('');
const customInstructions = ref('');
const generalStrategyIds = ref<string[]>([]);
const moduleStrategyIds = ref<string[]>([]);
const selectedFile = ref<File | null>(null);
const sourceEdited = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const processing = ref(false);
const controller = ref<AbortController | null>(null);
const result = ref<AiImportTransformResult | null>(null);
const editableJson = ref('');
const jsonDirty = ref(false);
const validatingJson = ref(false);
const importing = ref(false);
const activeTab = ref('preview');
const duplicateNameStrategy = ref<ModuleImportDuplicateNameStrategy>('reject');

const targetOptions = computed(() =>
  (options.value?.targets ?? []).map((item) => ({
    label: item.label,
    value: item.value,
    description: item.description
  }))
);
const currentModeDescription = computed(
  () => options.value?.modes.find((item) => item.value === mode.value)?.description ?? ''
);
const sourceTooLong = computed(
  () => sourceText.value.length > (options.value?.limits.sourceMaxChars ?? Infinity)
);
const customInstructionsTooLong = computed(
  () =>
    customInstructions.value.length > (options.value?.limits.customInstructionsMaxChars ?? Infinity)
);
const canProcess = computed(
  () =>
    Boolean(modelFallbackGroupId.value && sourceText.value.trim()) &&
    !sourceTooLong.value &&
    !customInstructionsTooLong.value &&
    !processing.value
);
const duplicateOptions = [
  { label: '同名时拒绝', value: 'reject' },
  { label: '同名时自动重命名', value: 'rename' }
];
const decisionColumns: DataTableColumns<AiImportTransformResult['decisions'][number]> = [
  { title: '字段', key: 'field', width: 190 },
  {
    title: '当前值',
    key: 'value',
    render: (row) => h('code', JSON.stringify(row.value))
  },
  {
    title: '原值',
    key: 'previousValue',
    render: (row) =>
      h('code', row.previousValue === undefined ? '—' : JSON.stringify(row.previousValue))
  },
  { title: '来源', key: 'basis', width: 90 },
  { title: '置信度', key: 'confidence', width: 90 },
  { title: '说明', key: 'reason', minWidth: 220 }
];

onMounted(async () => {
  await Promise.all([loadOptions(), loadModels()]);
});

async function loadOptions() {
  try {
    const next = await fetchAiImportOptions(target.value, mode.value);
    options.value = next;
    generalStrategyIds.value = [...next.defaults.generalStrategyIds];
    moduleStrategyIds.value = [...next.defaults.moduleStrategyIds];
  } catch (error) {
    message.error(toMessage(error));
  }
}

async function loadModels() {
  loadingModels.value = true;
  try {
    const groups = await fetchModelFallbackGroups({ page: 1, pageSize: 100, isEnabled: true });
    modelGroupOptions.value = groups.items.map((group) => ({
      label: `${group.name}（${group.candidates.filter((item) => item.isEnabled).length} 个候选）`,
      value: group.id
    }));
  } catch (error) {
    message.error(toMessage(error));
  } finally {
    loadingModels.value = false;
  }
}

async function changeTarget(value: AiImportTarget) {
  if (result.value && !window.confirm('切换目标模块会清除当前 AI 处理结果，是否继续？')) return;
  target.value = value;
  clearResult();
  await loadOptions();
}

async function changeMode(value: AiImportMode) {
  mode.value = value;
  clearResult();
  await loadOptions();
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer();
    sourceText.value = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '');
    selectedFile.value = file;
    sourceEdited.value = false;
    clearResult();
  } catch {
    message.error('文件不是合法 UTF-8 文本。');
  }
}

function markSourceEdited() {
  if (selectedFile.value) sourceEdited.value = true;
  clearResult();
}

function clearSource() {
  sourceText.value = '';
  selectedFile.value = null;
  sourceEdited.value = false;
  if (fileInput.value) fileInput.value.value = '';
  clearResult();
}

async function process() {
  if (!canProcess.value || !modelFallbackGroupId.value) return;
  processing.value = true;
  controller.value = new AbortController();
  try {
    const base = {
      target: target.value,
      modelFallbackGroupId: modelFallbackGroupId.value,
      mode: mode.value,
      generalStrategyIds: generalStrategyIds.value,
      moduleStrategyIds: moduleStrategyIds.value,
      customInstructions: customInstructions.value
    };
    result.value =
      selectedFile.value && !sourceEdited.value
        ? await transformAiImportFile(base, selectedFile.value, controller.value.signal)
        : await transformAiImport(
            { ...base, sourceText: sourceText.value },
            controller.value.signal
          );
    editableJson.value = result.value.rawJson;
    jsonDirty.value = false;
    activeTab.value = result.value.valid ? 'preview' : 'json';
    if (!result.value.valid) message.warning('AI 结果未通过确定性校验，请在 JSON 标签中修正。');
  } catch (error) {
    if ((error as Error).name !== 'AbortError') message.error(toMessage(error));
  } finally {
    processing.value = false;
    controller.value = null;
  }
}

function cancelProcessing() {
  controller.value?.abort();
}

function markJsonEdited() {
  jsonDirty.value = true;
}

async function validateEditedJson() {
  if (!result.value) return;
  validatingJson.value = true;
  try {
    const validation = await validateAiImportJson(target.value, editableJson.value);
    result.value = {
      ...result.value,
      rawJson: editableJson.value,
      result: validation.result ?? {},
      preview: validation.preview,
      errors: validation.errors,
      valid: validation.valid
    };
    jsonDirty.value = false;
    message[validation.valid ? 'success' : 'warning'](
      validation.valid ? 'JSON 已通过确定性校验。' : 'JSON 仍未通过校验。'
    );
  } catch (error) {
    message.error(toMessage(error));
  } finally {
    validatingJson.value = false;
  }
}

async function copyJson() {
  await navigator.clipboard.writeText(editableJson.value);
  message.success('JSON 已复制。');
}

async function confirmImport() {
  if (!result.value?.valid || jsonDirty.value) return;
  importing.value = true;
  try {
    await commitAiImport(target.value, editableJson.value, duplicateNameStrategy.value);
    message.success('导入成功。');
    await router.push(targetListPath(target.value));
  } catch (error) {
    message.error(toMessage(error));
  } finally {
    importing.value = false;
  }
}

function clearResult() {
  result.value = null;
  editableJson.value = '';
  jsonDirty.value = false;
}

function targetListPath(value: AiImportTarget): string {
  return {
    character: '/characters',
    persona: '/persona',
    prompt_preset: '/presets',
    world_book: '/worldbook',
    companion: '/companion'
  }[value];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败。';
}
</script>

<style scoped>
.ai-import-view {
  display: grid;
  gap: 18px;
}

.form-grid,
.strategy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.source-field,
.strategy-list {
  display: grid;
  width: 100%;
  gap: 10px;
}

.source-meta,
.result-header,
.commit-row,
.json-actions,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.source-meta > div,
.result-header > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hidden-file {
  display: none;
}

.mode-grid {
  display: flex;
  flex-wrap: wrap;
}

.strategy-list :deep(.n-checkbox) {
  align-items: flex-start;
}

.strategy-list :deep(.n-checkbox__label) {
  display: grid;
  gap: 2px;
}

.strategy-list span {
  color: var(--text-muted);
  font-size: 12px;
}

.limit-error {
  color: var(--error-color);
}

.result-panel {
  min-width: 0;
}

.result-header {
  margin-bottom: 14px;
}

.result-header h3 {
  margin: 0;
}

.result-alert {
  margin-bottom: 10px;
}

.json-preview {
  max-height: 600px;
  overflow: auto;
  padding: 14px;
  border-radius: 8px;
  background: var(--surface-base);
  white-space: pre-wrap;
  word-break: break-word;
}

.json-actions {
  justify-content: flex-end;
  margin-top: 12px;
}

.commit-row {
  justify-content: flex-end;
  margin-top: 18px;
}

.duplicate-select {
  width: 220px;
}

@media (max-width: 840px) {
  .form-grid,
  .strategy-grid {
    grid-template-columns: 1fr;
  }

  .source-meta,
  .result-header,
  .commit-row {
    align-items: stretch;
    flex-direction: column;
  }

  .duplicate-select {
    width: 100%;
  }
}
</style>
