<template>
  <n-drawer
    :show="show"
    :width="drawerWidth"
    placement="right"
    @update:show="$emit('update:show', $event)"
  >
    <n-drawer-content :title="title">
      <div class="module-json-import">
        <n-alert v-if="error" type="error" :bordered="false">
          {{ error }}
        </n-alert>

        <section class="module-json-import__section">
          <label class="module-json-import__file">
            <span>选择 JSON 文件</span>
            <input type="file" accept="application/json,.json" @change="readFile" />
          </label>

          <n-input
            v-model:value="rawJson"
            type="textarea"
            :autosize="{ minRows: 14, maxRows: 22 }"
            placeholder="粘贴可导入的 JSON 内容"
          />

          <n-checkbox v-model:checked="autoRename">同名时自动重命名</n-checkbox>
        </section>

        <section v-if="preview" class="module-json-import__preview">
          <h3>预览</h3>
          <dl>
            <div>
              <dt>格式</dt>
              <dd>{{ formatLabel }}</dd>
            </div>
            <div>
              <dt>名称</dt>
              <dd>{{ preview.name }}</dd>
            </div>
            <div v-if="preview.nameConflict">
              <dt>同名处理</dt>
              <dd>{{ autoRename ? `导入为 ${preview.suggestedName}` : '当前名称已存在' }}</dd>
            </div>
            <div v-for="item in previewItems" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <n-alert v-if="preview.nameConflict && !autoRename" type="warning" :bordered="false">
            当前库中已有同名内容，勾选自动重命名后才能直接导入。
          </n-alert>

          <n-alert v-if="preview.warnings.length > 0" type="warning" :bordered="false">
            <ul>
              <li v-for="warning in warningMessages" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </n-alert>

          <slot name="preview-details" :preview="preview" />
        </section>

        <n-space justify="end">
          <n-button :disabled="previewing || importing" @click="$emit('update:show', false)">
            取消
          </n-button>
          <n-button :loading="previewing" :disabled="!canSubmit || importing" @click="previewJson">
            预览 JSON
          </n-button>
          <n-button type="primary" :loading="importing" :disabled="!canImport" @click="commitJson">
            确认导入
          </n-button>
        </n-space>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  CharacterImportPreview,
  CompanionImportPreview,
  ModuleImportDuplicateNameStrategy,
  PersonaImportPreview,
  PromptPresetImportPreview,
  WorldBookImportPreview
} from '@tavern/shared';

type ImportPreview =
  | CharacterImportPreview
  | CompanionImportPreview
  | PersonaImportPreview
  | PromptPresetImportPreview
  | WorldBookImportPreview;

const props = defineProps<{
  show: boolean;
  title: string;
  formatLabel: string;
  preview: ImportPreview | null;
  previewing: boolean;
  importing: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  preview: [payload: { rawJson: string; duplicateNameStrategy: ModuleImportDuplicateNameStrategy }];
  commit: [payload: { rawJson: string; duplicateNameStrategy: ModuleImportDuplicateNameStrategy }];
}>();

defineSlots<{
  'preview-details'?: (props: { preview: any }) => unknown;
}>();

const rawJson = ref('');
const previewedRawJson = ref('');
const autoRename = ref(false);
const drawerWidth = computed(() => Math.min(680, window.innerWidth));
const duplicateNameStrategy = computed<ModuleImportDuplicateNameStrategy>(() =>
  autoRename.value ? 'rename' : 'reject'
);
const canSubmit = computed(() => rawJson.value.trim().length > 0);
const canImport = computed(
  () =>
    canSubmit.value &&
    rawJson.value === previewedRawJson.value &&
    props.preview !== null &&
    (!props.preview.nameConflict || duplicateNameStrategy.value === 'rename') &&
    !props.previewing
);
const previewItems = computed(() => {
  if (!props.preview) {
    return [];
  }

  if ('entries' in props.preview) {
    return [
      { label: '条目数', value: String(props.preview.entries.length) },
      { label: '启用状态', value: props.preview.isEnabled ? '启用' : '停用' },
      { label: 'Scan Depth', value: String(props.preview.scanDepth) },
      { label: 'Token Budget', value: String(props.preview.tokenBudget) }
    ];
  }

  if ('outputRules' in props.preview) {
    return [
      { label: '默认预设', value: props.preview.isDefault ? '是' : '否' },
      { label: '系统 Prompt', value: `${props.preview.systemPrompt.length} 字符` },
      { label: '输出约束', value: `${props.preview.outputRules.length} 字符` },
      {
        label: '参数',
        value: props.preview.parameters ? JSON.stringify(props.preview.parameters) : '未设置'
      }
    ];
  }

  if ('firstMessage' in props.preview) {
    return [
      { label: '开场白', value: props.preview.firstMessage ? '已提供' : '未提供' },
      { label: '示例对话', value: `${props.preview.exampleMessages.length} 条` },
      { label: '元数据', value: `${Object.keys(props.preview.metadata).length} 项` }
    ];
  }

  if ('identityPrompt' in props.preview) {
    return [
      { label: '来源格式', value: props.preview.format },
      { label: '身份设定', value: `${props.preview.identityPrompt.length} 字符` }
    ];
  }

  return [
    { label: '默认 Persona', value: props.preview.isDefault ? '是' : '否' },
    { label: '正文长度', value: `${props.preview.content.length} 字符` }
  ];
});

const warningMessages = computed(() => {
  if (!props.preview) {
    return [];
  }

  return props.preview.warnings.map((warning) =>
    typeof warning === 'string'
      ? warning
      : `${warning.field ? `${warning.field}: ` : ''}${warning.message}`
  );
});

function previewJson() {
  previewedRawJson.value = rawJson.value;
  emit('preview', {
    rawJson: rawJson.value,
    duplicateNameStrategy: duplicateNameStrategy.value
  });
}

function commitJson() {
  emit('commit', {
    rawJson: rawJson.value,
    duplicateNameStrategy: duplicateNameStrategy.value
  });
}

async function readFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  rawJson.value = await file.text();
  previewedRawJson.value = '';
  input.value = '';
}
</script>

<style scoped>
.module-json-import {
  display: grid;
  gap: 18px;
}

.module-json-import__section,
.module-json-import__preview {
  display: grid;
  gap: 12px;
}

.module-json-import__file {
  display: grid;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.module-json-import__file input {
  color: var(--text-strong);
}

.module-json-import__preview {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface-panel);
}

.module-json-import__preview h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
}

.module-json-import__preview dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.module-json-import__preview dl div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 10px;
}

.module-json-import__preview dt {
  color: var(--text-muted);
}

.module-json-import__preview dd {
  min-width: 0;
  margin: 0;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}

.module-json-import__preview ul {
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 720px) {
  .module-json-import__preview dl div {
    grid-template-columns: 1fr;
  }
}
</style>
