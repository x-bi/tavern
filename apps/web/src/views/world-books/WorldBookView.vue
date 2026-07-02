<template>
  <main class="world-book-view page-shell">
    <header class="page-shell__header world-book-view__header">
      <div>
        <h2>世界书</h2>
        <p>维护世界书与条目数据，后续阶段会基于这些字段接入命中和注入流程。</p>
      </div>
      <n-button type="primary" @click="openCreate">新建世界书</n-button>
    </header>

    <section class="world-book-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索世界书名称或描述"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState v-if="worldBookStore.loading" text="正在加载世界书" />

    <ErrorState
      v-else-if="worldBookStore.error"
      title="世界书加载失败"
      :description="worldBookStore.error"
    />

    <section v-else class="world-book-workspace">
      <aside class="world-book-list" aria-label="世界书列表">
        <template v-if="!worldBookStore.hasWorldBooks">
          <EmptyState
            title="还没有世界书"
            description="新建世界书后，可以维护关键词条目、优先级和启用状态。"
          />
        </template>

        <template v-else>
          <button
            v-for="worldBook in worldBookStore.items"
            :key="worldBook.id"
            class="world-book-list__item"
            :class="{ 'world-book-list__item--active': worldBook.id === worldBookStore.selectedId }"
            type="button"
            @click="worldBookStore.selectWorldBook(worldBook.id)"
          >
            <span class="world-book-list__title">
              <strong>{{ worldBook.name }}</strong>
              <n-tag
                size="small"
                :type="worldBook.isEnabled ? 'success' : 'default'"
                :bordered="false"
              >
                {{ worldBook.isEnabled ? '启用' : '停用' }}
              </n-tag>
            </span>
            <span class="world-book-list__description">
              {{ worldBook.description || '未填写描述' }}
            </span>
            <span class="world-book-list__meta">
              <span>{{ worldBook.entries.length }} 条目</span>
              <span>scan {{ worldBook.scanDepth }}</span>
              <span>budget {{ worldBook.tokenBudget }}</span>
            </span>
          </button>
        </template>
      </aside>

      <section class="world-book-view__editor">
        <div v-if="worldBookStore.selectedWorldBook" class="world-book-view__editor-actions">
          <n-space justify="end">
            <n-button
              secondary
              type="error"
              :loading="deletingWorldBookId === worldBookStore.selectedWorldBook.id"
              @click="confirmDeleteWorldBook(worldBookStore.selectedWorldBook)"
            >
              删除世界书
            </n-button>
          </n-space>
        </div>

        <WorldBookEditor
          ref="editorRef"
          :world-book="worldBookStore.selectedWorldBook"
          :submitting="worldBookStore.saving"
          :entry-submitting="worldBookStore.entrySaving"
          :deleting-entry-id="deletingEntryId"
          :save-error="worldBookStore.saveError"
          :entry-error="worldBookStore.entryError"
          @submit-book="saveWorldBook"
          @create-entry="createEntry"
          @update-entry="updateEntry"
          @delete-entry="confirmDeleteEntry"
        />
      </section>
    </section>

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content title="新建世界书">
        <n-alert
          v-if="worldBookStore.saveError"
          class="world-book-view__drawer-error"
          type="error"
          :bordered="false"
        >
          {{ worldBookStore.saveError }}
        </n-alert>

        <n-form
          ref="createFormRef"
          :model="createForm"
          :rules="createRules"
          label-placement="top"
          @submit.prevent="submitCreateWorldBook"
        >
          <n-form-item label="世界书名称" path="name">
            <n-input
              v-model:value="createForm.name"
              maxlength="120"
              show-count
              placeholder="角色世界设定"
            />
          </n-form-item>

          <n-form-item label="关联角色 ID">
            <n-input
              v-model:value="createForm.characterId"
              clearable
              placeholder="可选，留空表示不绑定角色"
            />
          </n-form-item>

          <n-form-item label="描述">
            <n-input
              v-model:value="createForm.description"
              type="textarea"
              maxlength="4000"
              show-count
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder="说明这本世界书适用的角色、场景或设定范围。"
            />
          </n-form-item>

          <div class="world-book-view__drawer-grid">
            <n-form-item label="Scan Depth" path="scanDepth">
              <n-input-number
                v-model:value="createForm.scanDepth"
                :min="1"
                :max="200"
                :step="1"
                placeholder="6"
              />
            </n-form-item>

            <n-form-item label="Token Budget" path="tokenBudget">
              <n-input-number
                v-model:value="createForm.tokenBudget"
                :min="1"
                :max="200000"
                :step="100"
                placeholder="1000"
              />
            </n-form-item>
          </div>

          <div class="world-book-view__switches">
            <n-checkbox v-model:checked="createForm.isEnabled">启用世界书</n-checkbox>
          </div>

          <n-space justify="end">
            <n-button :disabled="worldBookStore.saving" @click="closeCreate">取消</n-button>
            <n-button type="primary" :loading="worldBookStore.saving" attr-type="submit">
              创建世界书
            </n-button>
          </n-space>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { computed, onMounted, reactive, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import type {
  WorldBook,
  WorldBookEntry,
  WorldBookEntryMutationPayload,
  WorldBookMutationPayload
} from '../../api/worldBooks';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import WorldBookEditor from '../../components/WorldBookEditor.vue';
import { useWorldBookStore } from '../../stores/worldBook';
import type { WorldBookEntryPayload, WorldBookPayload } from '@tavern/shared';

type CreateWorldBookFormState = {
  name: string;
  characterId: string;
  description: string;
  scanDepth: number;
  tokenBudget: number;
  isEnabled: boolean;
};

const worldBookStore = useWorldBookStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(worldBookStore.search);
const drawerVisible = ref(false);
const deletingWorldBookId = ref<string | null>(null);
const deletingEntryId = ref<string | null>(null);
const createFormRef = ref<FormInst | null>(null);
const editorRef = ref<InstanceType<typeof WorldBookEditor> | null>(null);
const drawerWidth = computed(() => Math.min(620, window.innerWidth));
const createForm = reactive<CreateWorldBookFormState>(createEmptyWorldBookForm());

const createRules: FormRules = {
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

onMounted(() => {
  void worldBookStore.loadWorldBooks();
});

function applySearch() {
  worldBookStore.setSearch(searchText.value);
  void worldBookStore.loadWorldBooks({
    page: 1,
    search: searchText.value
  });
}

function openCreate() {
  Object.assign(createForm, createEmptyWorldBookForm());
  worldBookStore.saveError = null;
  drawerVisible.value = true;
}

function closeCreate() {
  drawerVisible.value = false;
}

async function submitCreateWorldBook() {
  try {
    await createFormRef.value?.validate();
  } catch {
    return;
  }

  const result = await worldBookStore.createWorldBook({
    name: createForm.name.trim(),
    characterId: createForm.characterId.trim() || null,
    description: createForm.description.trim(),
    scanDepth: createForm.scanDepth,
    tokenBudget: createForm.tokenBudget,
    isEnabled: createForm.isEnabled
  });

  if (!result) {
    return;
  }

  message.success('世界书已创建');
  closeCreate();
}

async function saveWorldBook(payload: WorldBookPayload | WorldBookMutationPayload) {
  const selected = worldBookStore.selectedWorldBook;

  if (!selected) {
    return;
  }

  const result = await worldBookStore.updateWorldBook(selected.id, payload);

  if (result) {
    message.success('世界书已保存');
  } else if (worldBookStore.saveError) {
    message.error(worldBookStore.saveError);
  }
}

function confirmDeleteWorldBook(worldBook: WorldBook) {
  dialog.warning({
    title: '删除世界书',
    content: `确认删除“${worldBook.name}”？相关条目也会从当前列表移除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deleteWorldBook(worldBook.id)
  });
}

async function deleteWorldBook(id: string) {
  deletingWorldBookId.value = id;

  try {
    const deleted = await worldBookStore.deleteWorldBook(id);

    if (deleted) {
      message.success('世界书已删除');
    } else if (worldBookStore.saveError) {
      message.error(worldBookStore.saveError);
    }
  } finally {
    deletingWorldBookId.value = null;
  }
}

async function createEntry(payload: WorldBookEntryPayload) {
  const selected = worldBookStore.selectedWorldBook;

  if (!selected) {
    return;
  }

  const result = await worldBookStore.createEntry(selected.id, payload);

  if (result) {
    editorRef.value?.closeEntryForm();
    message.success('世界书条目已创建');
  } else if (worldBookStore.entryError) {
    message.error(worldBookStore.entryError);
  }
}

async function updateEntry(id: string, payload: WorldBookEntryMutationPayload) {
  const result = await worldBookStore.updateEntry(id, payload);

  if (result) {
    editorRef.value?.closeEntryForm();
    message.success('世界书条目已保存');
  } else if (worldBookStore.entryError) {
    message.error(worldBookStore.entryError);
  }
}

function confirmDeleteEntry(entry: WorldBookEntry) {
  dialog.warning({
    title: '删除世界书条目',
    content: `确认删除“${entry.title}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deleteEntry(entry)
  });
}

async function deleteEntry(entry: WorldBookEntry) {
  deletingEntryId.value = entry.id;

  try {
    const deleted = await worldBookStore.deleteEntry(entry.id, entry.worldBookId);

    if (deleted) {
      message.success('世界书条目已删除');
    } else if (worldBookStore.entryError) {
      message.error(worldBookStore.entryError);
    }
  } finally {
    deletingEntryId.value = null;
  }
}

function createEmptyWorldBookForm(): CreateWorldBookFormState {
  return {
    name: '',
    characterId: '',
    description: '',
    scanDepth: 6,
    tokenBudget: 1000,
    isEnabled: true
  };
}
</script>

<style scoped>
.world-book-view {
  align-content: start;
}

.world-book-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.world-book-view__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 480px) auto;
  gap: 10px;
  align-items: center;
}

.world-book-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.world-book-list {
  display: grid;
  gap: 10px;
}

.world-book-list__item {
  display: grid;
  gap: 10px;
  width: 100%;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface-panel);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.world-book-list__item--active {
  border-color: rgba(99, 102, 241, 0.68);
  background: #202a41;
}

.world-book-list__title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.world-book-list__title strong {
  overflow: hidden;
  min-width: 0;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-book-list__description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-muted);
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.world-book-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.world-book-view__editor {
  display: grid;
  gap: 12px;
}

.world-book-view__editor-actions {
  min-height: 34px;
}

.world-book-view__drawer-error {
  margin-bottom: 16px;
}

.world-book-view__drawer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.world-book-view__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 1040px) {
  .world-book-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .world-book-view__header,
  .world-book-view__toolbar,
  .world-book-view__drawer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
