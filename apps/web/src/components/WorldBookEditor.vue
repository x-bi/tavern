<template>
  <section class="world-book-editor">
    <EmptyState
      v-if="!worldBook"
      title="请选择世界书"
      description="从左侧选择一本世界书，或新建后维护条目。"
    />

    <template v-else>
      <section class="world-book-editor__section">
        <div class="world-book-editor__section-header">
          <div>
            <h3>基础设置</h3>
            <p>维护世界书名称、启用状态和后续匹配会使用的预算字段。</p>
          </div>
        </div>

        <n-alert v-if="saveError" class="world-book-editor__alert" type="error" :bordered="false">
          {{ saveError }}
        </n-alert>

        <n-form
          ref="bookFormRef"
          :model="bookForm"
          :rules="bookRules"
          label-placement="top"
          @submit.prevent="submitBook"
        >
          <div class="world-book-editor__grid">
            <n-form-item label="世界书名称" path="name">
              <n-input
                v-model:value="bookForm.name"
                maxlength="120"
                show-count
                placeholder="角色世界设定"
              />
            </n-form-item>

            <n-form-item label="关联角色 ID">
              <n-input
                v-model:value="bookForm.characterId"
                clearable
                placeholder="可选，留空表示不绑定角色"
              />
            </n-form-item>
          </div>

          <n-form-item label="描述">
            <n-input
              v-model:value="bookForm.description"
              type="textarea"
              maxlength="4000"
              show-count
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="说明这本世界书适用的角色、场景或设定范围。"
            />
          </n-form-item>

          <div class="world-book-editor__grid world-book-editor__grid--compact">
            <n-form-item label="Scan Depth" path="scanDepth">
              <n-input-number
                v-model:value="bookForm.scanDepth"
                :min="1"
                :max="200"
                :step="1"
                placeholder="6"
              />
            </n-form-item>

            <n-form-item label="Token Budget" path="tokenBudget">
              <n-input-number
                v-model:value="bookForm.tokenBudget"
                :min="1"
                :max="200000"
                :step="100"
                placeholder="1000"
              />
            </n-form-item>
          </div>

          <div class="world-book-editor__switches">
            <n-checkbox v-model:checked="bookForm.isEnabled">启用世界书</n-checkbox>
          </div>

          <n-space justify="end">
            <n-button type="primary" :loading="submitting" attr-type="submit">保存世界书</n-button>
          </n-space>
        </n-form>
      </section>

      <section class="world-book-editor__section">
        <div class="world-book-editor__section-header">
          <div>
            <h3>条目</h3>
            <p>维护关键词、正文、优先级、启用状态和插入位置。</p>
          </div>
          <n-button secondary type="primary" @click="openCreateEntry">新建条目</n-button>
        </div>

        <n-alert v-if="entryError" class="world-book-editor__alert" type="error" :bordered="false">
          {{ entryError }}
        </n-alert>

        <section v-if="entryFormVisible" class="entry-form-panel" aria-label="世界书条目表单">
          <div class="entry-form-panel__header">
            <h4>{{ editingEntryId ? '编辑条目' : '新建条目' }}</h4>
            <n-button size="small" secondary @click="closeEntryForm">收起</n-button>
          </div>

          <n-form
            ref="entryFormRef"
            :model="entryForm"
            :rules="entryRules"
            label-placement="top"
            @submit.prevent="submitEntry"
          >
            <div class="world-book-editor__grid">
              <n-form-item label="条目标题" path="title">
                <n-input
                  v-model:value="entryForm.title"
                  maxlength="160"
                  show-count
                  placeholder="资料馆钟声"
                />
              </n-form-item>

              <n-form-item label="优先级" path="priority">
                <n-input-number
                  v-model:value="entryForm.priority"
                  :min="-10000"
                  :max="10000"
                  :step="1"
                  placeholder="0"
                />
              </n-form-item>
            </div>

            <n-form-item label="关键词" path="keywordsText">
              <n-input
                v-model:value="entryForm.keywordsText"
                type="textarea"
                maxlength="6000"
                show-count
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="每行一个关键词，或使用英文逗号分隔。"
              />
            </n-form-item>

            <n-form-item label="二级关键词">
              <n-input
                v-model:value="entryForm.secondaryKeywordsText"
                type="textarea"
                maxlength="6000"
                show-count
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="可选，每行一个关键词，或使用英文逗号分隔。"
              />
            </n-form-item>

            <n-form-item label="条目正文" path="content">
              <n-input
                v-model:value="entryForm.content"
                type="textarea"
                maxlength="20000"
                show-count
                :autosize="{ minRows: 8, maxRows: 18 }"
                placeholder="写入世界设定、地点、人物关系或背景信息。"
              />
            </n-form-item>

            <div class="world-book-editor__grid world-book-editor__grid--compact">
              <n-form-item label="条目 Token Budget">
                <n-input-number
                  v-model:value="entryForm.tokenBudget"
                  clearable
                  :min="1"
                  :max="200000"
                  :step="100"
                  placeholder="可选"
                />
              </n-form-item>

              <n-form-item label="插入位置">
                <div class="insertion-options">
                  <n-button
                    v-for="option in insertionOrderOptions"
                    :key="option.value"
                    size="small"
                    :type="entryForm.insertionOrder === option.value ? 'primary' : 'default'"
                    secondary
                    @click="entryForm.insertionOrder = option.value"
                  >
                    {{ option.label }}
                  </n-button>
                </div>
              </n-form-item>
            </div>

            <div class="world-book-editor__switches">
              <n-checkbox v-model:checked="entryForm.isEnabled">启用条目</n-checkbox>
              <n-checkbox v-model:checked="entryForm.caseSensitive">区分大小写</n-checkbox>
            </div>

            <n-space justify="end">
              <n-button :disabled="entrySubmitting" @click="closeEntryForm">取消</n-button>
              <n-button type="primary" :loading="entrySubmitting" attr-type="submit">
                {{ editingEntryId ? '保存条目' : '创建条目' }}
              </n-button>
            </n-space>
          </n-form>
        </section>

        <EmptyState
          v-if="worldBook.entries.length === 0 && !entryFormVisible"
          title="还没有世界书条目"
          description="新建条目后，可以维护关键词、正文、优先级和启用状态。"
        />

        <section v-else class="entry-list" aria-label="世界书条目列表">
          <article v-for="entry in worldBook.entries" :key="entry.id" class="entry-item">
            <header class="entry-item__header">
              <div class="entry-item__title">
                <strong>{{ entry.title }}</strong>
                <n-tag
                  size="small"
                  :type="entry.isEnabled ? 'success' : 'default'"
                  :bordered="false"
                >
                  {{ entry.isEnabled ? '启用' : '停用' }}
                </n-tag>
              </div>
              <n-space>
                <n-button size="small" secondary @click="openEditEntry(entry)">编辑</n-button>
                <n-button
                  size="small"
                  secondary
                  type="error"
                  :loading="deletingEntryId === entry.id"
                  @click="$emit('deleteEntry', entry)"
                >
                  删除
                </n-button>
              </n-space>
            </header>

            <div class="entry-item__meta">
              <n-tag size="small">priority {{ entry.priority }}</n-tag>
              <n-tag size="small">{{ insertionOrderLabel(entry.insertionOrder) }}</n-tag>
              <n-tag v-if="entry.tokenBudget !== null" size="small">
                budget {{ entry.tokenBudget }}
              </n-tag>
              <n-tag v-if="entry.caseSensitive" size="small">case sensitive</n-tag>
            </div>

            <div class="entry-item__keywords">
              <span v-for="keyword in entry.keywords" :key="keyword">{{ keyword }}</span>
            </div>

            <p class="entry-item__content">{{ entry.content || '未填写条目正文' }}</p>
          </article>
        </section>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { reactive, ref, watch } from 'vue';

import type { WorldBook, WorldBookEntry } from '../api/worldBooks';
import EmptyState from './EmptyState.vue';
import type {
  WorldBookEntryInsertionOrder,
  WorldBookEntryPayload,
  WorldBookEntryUpdatePayload,
  WorldBookPayload,
  WorldBookUpdatePayload
} from '@tavern/shared';

type WorldBookFormState = {
  name: string;
  characterId: string;
  description: string;
  scanDepth: number;
  tokenBudget: number;
  isEnabled: boolean;
};

type EntryFormState = {
  title: string;
  content: string;
  keywordsText: string;
  secondaryKeywordsText: string;
  priority: number;
  tokenBudget: number | null;
  insertionOrder: WorldBookEntryInsertionOrder;
  isEnabled: boolean;
  caseSensitive: boolean;
};

const props = withDefaults(
  defineProps<{
    worldBook?: WorldBook | null;
    submitting?: boolean;
    entrySubmitting?: boolean;
    deletingEntryId?: string | null;
    saveError?: string | null;
    entryError?: string | null;
  }>(),
  {
    worldBook: null,
    submitting: false,
    entrySubmitting: false,
    deletingEntryId: null,
    saveError: null,
    entryError: null
  }
);

const emit = defineEmits<{
  submitBook: [payload: WorldBookPayload | WorldBookUpdatePayload];
  createEntry: [payload: WorldBookEntryPayload];
  updateEntry: [id: string, payload: WorldBookEntryUpdatePayload];
  deleteEntry: [entry: WorldBookEntry];
}>();

const insertionOrderOptions: { value: WorldBookEntryInsertionOrder; label: string }[] = [
  { value: 'before_history', label: '历史前' },
  { value: 'after_history', label: '历史后' },
  { value: 'before_current_user_input', label: '用户输入前' },
  { value: 'after_current_user_input', label: '用户输入后' }
];

const bookFormRef = ref<FormInst | null>(null);
const entryFormRef = ref<FormInst | null>(null);
const entryFormVisible = ref(false);
const editingEntryId = ref<string | null>(null);
const bookForm = reactive<WorldBookFormState>(createEmptyBookForm());
const entryForm = reactive<EntryFormState>(createEmptyEntryForm());

const bookRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入世界书名称',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '世界书名称不能只包含空格',
      trigger: ['blur', 'input']
    }
  ],
  scanDepth: {
    type: 'number',
    min: 1,
    max: 200,
    message: 'Scan Depth 范围为 1 到 200',
    trigger: ['blur', 'change']
  },
  tokenBudget: {
    type: 'number',
    min: 1,
    max: 200000,
    message: 'Token Budget 范围为 1 到 200000',
    trigger: ['blur', 'change']
  }
};

const entryRules: FormRules = {
  title: [
    {
      required: true,
      message: '请输入条目标题',
      trigger: ['blur', 'input']
    },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '条目标题不能只包含空格',
      trigger: ['blur', 'input']
    }
  ],
  content: {
    validator: (_rule, value: string) => value.trim().length > 0,
    message: '请输入条目正文',
    trigger: ['blur', 'input']
  },
  keywordsText: {
    validator: (_rule, value: string) => parseKeywords(value).length > 0,
    message: '至少填写一个关键词',
    trigger: ['blur', 'input']
  },
  priority: {
    type: 'number',
    min: -10000,
    max: 10000,
    message: '优先级范围为 -10000 到 10000',
    trigger: ['blur', 'change']
  }
};

watch(
  () => props.worldBook,
  (worldBook) => {
    Object.assign(bookForm, worldBook ? toBookForm(worldBook) : createEmptyBookForm());
    closeEntryForm();
  },
  { immediate: true }
);

async function submitBook() {
  try {
    await bookFormRef.value?.validate();
  } catch {
    return;
  }

  emit('submitBook', {
    name: bookForm.name.trim(),
    characterId: bookForm.characterId.trim() || null,
    description: bookForm.description.trim(),
    scanDepth: bookForm.scanDepth,
    tokenBudget: bookForm.tokenBudget,
    isEnabled: bookForm.isEnabled
  });
}

function openCreateEntry() {
  editingEntryId.value = null;
  Object.assign(entryForm, createEmptyEntryForm());
  entryFormVisible.value = true;
}

function openEditEntry(entry: WorldBookEntry) {
  editingEntryId.value = entry.id;
  Object.assign(entryForm, toEntryForm(entry));
  entryFormVisible.value = true;
}

function closeEntryForm() {
  editingEntryId.value = null;
  entryFormVisible.value = false;
  Object.assign(entryForm, createEmptyEntryForm());
}

async function submitEntry() {
  try {
    await entryFormRef.value?.validate();
  } catch {
    return;
  }

  const payload = toEntryPayload();

  if (editingEntryId.value) {
    emit('updateEntry', editingEntryId.value, payload);
  } else {
    emit('createEntry', payload as WorldBookEntryPayload);
  }
}

function createEmptyBookForm(): WorldBookFormState {
  return {
    name: '',
    characterId: '',
    description: '',
    scanDepth: 6,
    tokenBudget: 1000,
    isEnabled: true
  };
}

function toBookForm(worldBook: WorldBook): WorldBookFormState {
  return {
    name: worldBook.name,
    characterId: worldBook.characterId ?? '',
    description: worldBook.description,
    scanDepth: worldBook.scanDepth,
    tokenBudget: worldBook.tokenBudget,
    isEnabled: worldBook.isEnabled
  };
}

function createEmptyEntryForm(): EntryFormState {
  return {
    title: '',
    content: '',
    keywordsText: '',
    secondaryKeywordsText: '',
    priority: 0,
    tokenBudget: null,
    insertionOrder: 'before_history',
    isEnabled: true,
    caseSensitive: false
  };
}

function toEntryForm(entry: WorldBookEntry): EntryFormState {
  return {
    title: entry.title,
    content: entry.content,
    keywordsText: entry.keywords.join('\n'),
    secondaryKeywordsText: entry.secondaryKeywords.join('\n'),
    priority: entry.priority,
    tokenBudget: entry.tokenBudget,
    insertionOrder: entry.insertionOrder,
    isEnabled: entry.isEnabled,
    caseSensitive: entry.caseSensitive
  };
}

function toEntryPayload(): WorldBookEntryPayload | WorldBookEntryUpdatePayload {
  return {
    title: entryForm.title.trim(),
    content: entryForm.content.trim(),
    keywords: parseKeywords(entryForm.keywordsText),
    secondaryKeywords: parseKeywords(entryForm.secondaryKeywordsText),
    priority: entryForm.priority,
    tokenBudget: entryForm.tokenBudget ?? null,
    insertionOrder: entryForm.insertionOrder,
    isEnabled: entryForm.isEnabled,
    caseSensitive: entryForm.caseSensitive
  };
}

function parseKeywords(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function insertionOrderLabel(value: WorldBookEntryInsertionOrder): string {
  return insertionOrderOptions.find((option) => option.value === value)?.label ?? value;
}

defineExpose({
  closeEntryForm
});
</script>

<style scoped>
.world-book-editor {
  display: grid;
  gap: 16px;
}

.world-book-editor__section,
.entry-form-panel,
.entry-item {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.world-book-editor__section {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.world-book-editor__section-header,
.entry-form-panel__header,
.entry-item__header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
}

.world-book-editor__section-header h3,
.entry-form-panel__header h4 {
  margin: 0;
  color: var(--text-strong);
  line-height: 1.4;
}

.world-book-editor__section-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.world-book-editor__alert {
  margin-bottom: 2px;
}

.world-book-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.world-book-editor__grid--compact {
  grid-template-columns: repeat(2, minmax(160px, 240px));
}

.world-book-editor__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-bottom: 18px;
}

.entry-form-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.insertion-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.entry-list {
  display: grid;
  gap: 12px;
}

.entry-item {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.entry-item__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.entry-item__title strong {
  overflow: hidden;
  max-width: 420px;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-item__meta,
.entry-item__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.entry-item__keywords span {
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  padding: 3px 9px;
  color: var(--text-strong);
  font-size: 12px;
  line-height: 1.5;
}

.entry-item__content {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

@media (max-width: 840px) {
  .world-book-editor__grid,
  .world-book-editor__grid--compact {
    grid-template-columns: 1fr;
  }

  .world-book-editor__section-header,
  .entry-form-panel__header,
  .entry-item__header {
    display: grid;
  }
}
</style>
