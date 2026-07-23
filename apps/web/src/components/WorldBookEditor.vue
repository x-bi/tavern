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

            <n-form-item label="关联角色">
              <n-select
                v-model:value="bookForm.characterIds"
                multiple
                filterable
                clearable
                :loading="charactersLoading"
                :options="characterOptions"
                max-tag-count="responsive"
                placeholder="可多选；留空且启用时为全局世界书"
              />
            </n-form-item>

            <n-form-item label="关联 Persona">
              <n-select
                v-model:value="bookForm.personaIds"
                multiple
                filterable
                clearable
                :loading="bindingsLoading"
                :options="personaOptions"
                max-tag-count="responsive"
                placeholder="可多选；仅在指定 Persona 下生效"
              />
            </n-form-item>

            <n-form-item label="关联会话">
              <n-select
                v-model:value="bookForm.conversationIds"
                multiple
                filterable
                clearable
                :loading="bindingsLoading"
                :options="conversationOptions"
                max-tag-count="responsive"
                placeholder="可多选；仅在指定会话中生效"
              />
            </n-form-item>

            <n-form-item label="关联 AI 角色">
              <n-select
                v-model:value="bookForm.companionIds"
                multiple
                filterable
                clearable
                :loading="bindingsLoading"
                :options="companionOptions"
                max-tag-count="responsive"
                placeholder="可多选；仅在指定 AI 角色中生效"
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
            <n-checkbox v-model:checked="bookForm.isSensitive">标记为敏感内容</n-checkbox>
            <n-checkbox v-if="isAdmin" v-model:checked="bookForm.isShared"
              >发布到成员内容库</n-checkbox
            >
          </div>

          <n-space justify="end">
            <n-button secondary :loading="exporting" @click="exportCurrentWorldBook">
              导出 JSON
            </n-button>
            <n-button type="primary" :loading="submitting" attr-type="submit">保存世界书</n-button>
          </n-space>
        </n-form>
      </section>

      <section class="world-book-editor__section">
        <div class="world-book-editor__section-header">
          <div>
            <h3>条目</h3>
            <p>维护世界书 V2 的触发、持续、冷却、预算和插入规则。</p>
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

              <n-form-item label="预算优先级" path="budgetPriority">
                <n-input-number
                  v-model:value="entryForm.budgetPriority"
                  :min="-10000"
                  :max="10000"
                  :step="1"
                  placeholder="0"
                />
              </n-form-item>
            </div>
            <div class="world-book-editor__grid world-book-editor__grid--compact">
              <n-form-item label="排序值">
                <n-input-number v-model:value="entryForm.sortOrder" :min="-10000" :max="10000" />
              </n-form-item>
              <n-form-item label="主关键词逻辑">
                <NSelect v-model:value="entryForm.primaryLogic" :options="primaryLogicOptions" />
              </n-form-item>
              <n-form-item label="二级关键词逻辑">
                <NSelect
                  v-model:value="entryForm.secondaryLogic"
                  :options="secondaryLogicOptions"
                />
              </n-form-item>
            </div>
            <div class="world-book-editor__grid">
              <n-form-item label="内容类型"
                ><NSelect v-model:value="entryForm.contentType" :options="contentTypeOptions"
              /></n-form-item>
              <n-form-item label="信任级别"
                ><NSelect v-model:value="entryForm.trustLevel" :options="trustLevelOptions"
              /></n-form-item>
              <n-form-item label="激活方式"
                ><NSelect v-model:value="entryForm.activationMode" :options="activationModeOptions"
              /></n-form-item>
              <n-form-item label="匹配方式"
                ><NSelect v-model:value="entryForm.matchMode" :options="matchModeOptions"
              /></n-form-item>
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

            <n-form-item label="排除关键词">
              <n-input
                v-model:value="entryForm.excludeKeywordsText"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="命中后阻止激活；每行一个或用英文逗号分隔。"
              />
            </n-form-item>

            <div class="world-book-editor__grid">
              <n-form-item label="扫描来源">
                <NSelect
                  v-model:value="entryForm.scanSources"
                  multiple
                  :options="scanSourceOptions"
                />
              </n-form-item>
              <n-form-item label="生成用途">
                <NSelect
                  v-model:value="entryForm.generationPurposes"
                  multiple
                  :options="generationPurposeOptions"
                />
              </n-form-item>
            </div>

            <div class="world-book-editor__grid world-book-editor__grid--compact">
              <n-form-item label="历史扫描深度">
                <n-input-number
                  v-model:value="entryForm.userHistoryScanDepth"
                  :min="0"
                  :max="100"
                />
              </n-form-item>
              <n-form-item label="Sticky 回合">
                <n-input-number v-model:value="entryForm.stickyTurns" :min="0" :max="100" />
              </n-form-item>
              <n-form-item label="Continuation 回合">
                <n-input-number v-model:value="entryForm.continuationTurns" :min="0" :max="100" />
              </n-form-item>
              <n-form-item label="Delay 回合">
                <n-input-number v-model:value="entryForm.delayTurns" :min="0" :max="100" />
              </n-form-item>
              <n-form-item label="Cooldown 回合">
                <n-input-number v-model:value="entryForm.cooldownTurns" :min="0" :max="100" />
              </n-form-item>
              <n-form-item label="Cooldown 策略">
                <NSelect
                  v-model:value="entryForm.cooldownPolicy"
                  :options="cooldownPolicyOptions"
                />
              </n-form-item>
            </div>

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

            <n-form-item label="压缩正文（可选）">
              <n-input
                v-model:value="entryForm.compactContent"
                type="textarea"
                maxlength="20000"
                show-count
                :autosize="{ minRows: 3, maxRows: 8 }"
                placeholder="预算紧张时可使用的精简内容。"
              />
              <n-alert
                v-if="editingEntry?.compactStale"
                type="warning"
                :bordered="false"
                class="world-book-editor__compact-warning"
              >
                正文已变化，当前压缩正文已失效；请同步更新或清空压缩正文。
              </n-alert>
            </n-form-item>

            <div class="world-book-editor__grid world-book-editor__grid--compact">
              <n-form-item label="条目 Max Tokens">
                <n-input-number
                  v-model:value="entryForm.maxTokens"
                  clearable
                  :min="1"
                  :max="200000"
                  :step="100"
                  placeholder="可选"
                />
              </n-form-item>

              <n-form-item label="插入位置">
                <div class="placement-options">
                  <n-button
                    v-for="option in placementOptions"
                    :key="option.value"
                    size="small"
                    :type="entryForm.placement === option.value ? 'primary' : 'default'"
                    secondary
                    @click="entryForm.placement = option.value"
                  >
                    {{ option.label }}
                  </n-button>
                </div>
              </n-form-item>
            </div>

            <div class="world-book-editor__switches">
              <n-checkbox v-model:checked="entryForm.isEnabled">启用条目</n-checkbox>
              <n-checkbox v-model:checked="entryForm.sameMessageOnly">二级词限同一消息</n-checkbox>
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
              <n-tag size="small">budget {{ entry.budgetPriority }}</n-tag>
              <n-tag size="small">sort {{ entry.sortOrder }}</n-tag>
              <n-tag size="small">{{ placementLabel(entry.placement) }}</n-tag>
              <n-tag v-if="entry.maxTokens !== null" size="small">
                max {{ entry.maxTokens }}
              </n-tag>
              <n-tag v-if="entry.compactStale" size="small" type="warning">压缩正文已失效</n-tag>
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
import { useMessage } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';

import { exportWorldBookJson, type WorldBook, type WorldBookEntry } from '../api/worldBooks';
import { getStoredCurrentUser } from '../api/auth';
import { downloadJson } from '../utils/downloadJson';
import EmptyState from './EmptyState.vue';
import type {
  WorldBookPlacement,
  WorldBookEntryPayload,
  WorldBookEntryUpdatePayload,
  WorldBookPayload,
  WorldBookUpdatePayload
} from '@tavern/shared';

type WorldBookFormState = {
  name: string;
  characterIds: string[];
  personaIds: string[];
  conversationIds: string[];
  companionIds: string[];
  description: string;
  scanDepth: number;
  tokenBudget: number;
  isEnabled: boolean;
  isSensitive: boolean;
  isShared: boolean;
};

type EntryFormState = {
  title: string;
  content: string;
  keywordsText: string;
  secondaryKeywordsText: string;
  excludeKeywordsText: string;
  budgetPriority: number;
  maxTokens: number | null;
  placement: WorldBookPlacement;
  isEnabled: boolean;
  contentType: WorldBookEntry['contentType'];
  trustLevel: WorldBookEntry['trustLevel'];
  activationMode: WorldBookEntry['activationMode'];
  matchMode: WorldBookEntry['matchMode'];
  primaryLogic: WorldBookEntry['primaryLogic'];
  secondaryLogic: WorldBookEntry['secondaryLogic'];
  sameMessageOnly: boolean;
  scanSources: WorldBookEntry['scanSources'];
  userHistoryScanDepth: number;
  stickyTurns: number;
  continuationTurns: number;
  cooldownTurns: number;
  delayTurns: number;
  cooldownPolicy: WorldBookEntry['cooldownPolicy'];
  generationPurposes: WorldBookEntry['generationPurposes'];
  compactContent: string;
  sortOrder: number;
};

const props = withDefaults(
  defineProps<{
    worldBook?: WorldBook | null;
    submitting?: boolean;
    entrySubmitting?: boolean;
    deletingEntryId?: string | null;
    saveError?: string | null;
    entryError?: string | null;
    characterOptions?: Array<{ label: string; value: string }>;
    charactersLoading?: boolean;
    personaOptions?: Array<{ label: string; value: string }>;
    conversationOptions?: Array<{ label: string; value: string }>;
    companionOptions?: Array<{ label: string; value: string }>;
    bindingsLoading?: boolean;
  }>(),
  {
    worldBook: null,
    submitting: false,
    entrySubmitting: false,
    deletingEntryId: null,
    saveError: null,
    entryError: null,
    characterOptions: () => [],
    charactersLoading: false,
    personaOptions: () => [],
    conversationOptions: () => [],
    companionOptions: () => [],
    bindingsLoading: false
  }
);

const emit = defineEmits<{
  submitBook: [payload: WorldBookPayload | WorldBookUpdatePayload];
  createEntry: [payload: WorldBookEntryPayload];
  updateEntry: [id: string, payload: WorldBookEntryUpdatePayload];
  deleteEntry: [entry: WorldBookEntry];
}>();
const message = useMessage();
const exporting = ref(false);

async function exportCurrentWorldBook() {
  if (!props.worldBook) return;
  exporting.value = true;
  try {
    const result = await exportWorldBookJson(props.worldBook.id);
    downloadJson(result.fileName, result.card);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '世界书导出失败。');
  } finally {
    exporting.value = false;
  }
}

const placementOptions: { value: WorldBookPlacement; label: string }[] = [
  { value: 'instruction', label: '指令区' },
  { value: 'before_history', label: '历史前' },
  { value: 'after_history', label: '历史后' },
  { value: 'before_current_user', label: '当前输入前' }
];
const contentTypeOptions = ['lore', 'state', 'behavior_rule', 'reference'].map((value) => ({
  label: value,
  value
}));
const trustLevelOptions = ['user_authored', 'imported_untrusted', 'user_confirmed_import'].map(
  (value) => ({ label: value, value })
);
const activationModeOptions = ['keyword', 'constant', 'manual'].map((value) => ({
  label: value,
  value
}));
const matchModeOptions = ['normalized_phrase', 'contains'].map((value) => ({
  label: value,
  value
}));
const primaryLogicOptions = ['any', 'all'].map((value) => ({ label: value, value }));
const secondaryLogicOptions = ['and_any', 'and_all', 'not_any', 'not_all'].map((value) => ({
  label: value,
  value
}));
const scanSourceOptions = ['current_user', 'user_history', 'assistant_latest'].map((value) => ({
  label: value,
  value
}));
const generationPurposeOptions = [
  'chat_reply',
  'regenerate',
  'continue',
  'user_suggestions',
  'memory_summary'
].map((value) => ({ label: value, value }));
const cooldownPolicyOptions = ['strict', 'current_user_override'].map((value) => ({
  label: value,
  value
}));

const bookFormRef = ref<FormInst | null>(null);
const entryFormRef = ref<FormInst | null>(null);
const entryFormVisible = ref(false);
const editingEntryId = ref<string | null>(null);
const editingEntry = computed(() =>
  props.worldBook?.entries.find((entry) => entry.id === editingEntryId.value)
);
const bookForm = reactive<WorldBookFormState>(createEmptyBookForm());
const isAdmin = getStoredCurrentUser()?.role === 'admin';
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
  budgetPriority: {
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
    characterIds: [...bookForm.characterIds],
    personaIds: [...bookForm.personaIds],
    conversationIds: [...bookForm.conversationIds],
    companionIds: [...bookForm.companionIds],
    description: bookForm.description.trim(),
    scanDepth: bookForm.scanDepth,
    tokenBudget: bookForm.tokenBudget,
    isEnabled: bookForm.isEnabled,
    isSensitive: bookForm.isSensitive,
    ...(isAdmin ? { isShared: bookForm.isShared } : {})
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
    characterIds: [],
    personaIds: [],
    conversationIds: [],
    companionIds: [],
    description: '',
    scanDepth: 6,
    tokenBudget: 1000,
    isEnabled: true,
    isSensitive: false,
    isShared: false
  };
}

function toBookForm(worldBook: WorldBook): WorldBookFormState {
  return {
    name: worldBook.name,
    characterIds: [...worldBook.characterIds],
    personaIds: [...worldBook.personaIds],
    conversationIds: [...worldBook.conversationIds],
    companionIds: [...worldBook.companionIds],
    description: worldBook.description,
    scanDepth: worldBook.scanDepth,
    tokenBudget: worldBook.tokenBudget,
    isEnabled: worldBook.isEnabled,
    isSensitive: worldBook.isSensitive,
    isShared: worldBook.isShared
  };
}

function createEmptyEntryForm(): EntryFormState {
  return {
    title: '',
    content: '',
    keywordsText: '',
    secondaryKeywordsText: '',
    excludeKeywordsText: '',
    budgetPriority: 0,
    maxTokens: null,
    placement: 'before_history',
    isEnabled: true,
    contentType: 'lore',
    trustLevel: 'user_authored',
    activationMode: 'keyword',
    matchMode: 'normalized_phrase',
    primaryLogic: 'any',
    secondaryLogic: 'and_any',
    sameMessageOnly: true,
    scanSources: ['current_user', 'user_history', 'assistant_latest'],
    userHistoryScanDepth: 6,
    stickyTurns: 0,
    continuationTurns: 1,
    cooldownTurns: 0,
    delayTurns: 0,
    cooldownPolicy: 'strict',
    generationPurposes: ['chat_reply', 'regenerate', 'continue'],
    compactContent: '',
    sortOrder: 0
  };
}

function toEntryForm(entry: WorldBookEntry): EntryFormState {
  return {
    title: entry.title,
    content: entry.content,
    keywordsText: entry.keywords.join('\n'),
    secondaryKeywordsText: entry.secondaryKeywords.join('\n'),
    excludeKeywordsText: entry.excludeKeywords.join('\n'),
    budgetPriority: entry.budgetPriority,
    maxTokens: entry.maxTokens,
    placement: entry.placement,
    isEnabled: entry.isEnabled,
    contentType: entry.contentType,
    trustLevel: entry.trustLevel,
    activationMode: entry.activationMode,
    matchMode: entry.matchMode,
    primaryLogic: entry.primaryLogic,
    secondaryLogic: entry.secondaryLogic,
    sameMessageOnly: entry.sameMessageOnly,
    scanSources: [...entry.scanSources],
    userHistoryScanDepth: entry.userHistoryScanDepth,
    stickyTurns: entry.stickyTurns,
    continuationTurns: entry.continuationTurns,
    cooldownTurns: entry.cooldownTurns,
    delayTurns: entry.delayTurns,
    cooldownPolicy: entry.cooldownPolicy,
    generationPurposes: [...entry.generationPurposes],
    compactContent: entry.compactContent ?? '',
    sortOrder: entry.sortOrder
  };
}

function toEntryPayload(): WorldBookEntryPayload | WorldBookEntryUpdatePayload {
  return {
    title: entryForm.title.trim(),
    content: entryForm.content.trim(),
    keywords: parseKeywords(entryForm.keywordsText),
    secondaryKeywords: parseKeywords(entryForm.secondaryKeywordsText),
    excludeKeywords: parseKeywords(entryForm.excludeKeywordsText),
    budgetPriority: entryForm.budgetPriority,
    sortOrder: entryForm.sortOrder,
    contentType: entryForm.contentType,
    trustLevel: entryForm.trustLevel,
    activationMode: entryForm.activationMode,
    matchMode: entryForm.matchMode,
    primaryLogic: entryForm.primaryLogic,
    secondaryLogic: entryForm.secondaryLogic,
    sameMessageOnly: entryForm.sameMessageOnly,
    scanSources: [...entryForm.scanSources],
    userHistoryScanDepth: entryForm.userHistoryScanDepth,
    stickyTurns: entryForm.stickyTurns,
    continuationTurns: entryForm.continuationTurns,
    cooldownTurns: entryForm.cooldownTurns,
    delayTurns: entryForm.delayTurns,
    cooldownPolicy: entryForm.cooldownPolicy,
    generationPurposes: [...entryForm.generationPurposes],
    compactContent: entryForm.compactContent.trim() || null,
    maxTokens: entryForm.maxTokens ?? null,
    placement: entryForm.placement,
    isEnabled: entryForm.isEnabled
  };
}

function parseKeywords(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function placementLabel(value: WorldBookPlacement): string {
  return placementOptions.find((option) => option.value === value)?.label ?? value;
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

.placement-options {
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
