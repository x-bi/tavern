<template>
  <main class="world-book-view page-shell">
    <header class="page-shell__header world-book-view__header">
      <div>
        <h2>世界书</h2>
        <p>维护世界书、不可变条目版本，以及运行时命中和注入规则。</p>
      </div>
      <n-space v-if="activeScope === 'owned'" justify="end">
        <n-button secondary :loading="templateLoading" @click="downloadImportTemplate">
          导入模板
        </n-button>
        <n-button secondary @click="openImport">导入 JSON</n-button>
        <n-button type="primary" @click="openCreate">新建世界书</n-button>
      </n-space>
    </header>

    <n-tabs v-model:value="activeScope" type="segment">
      <n-tab name="owned">我的世界书</n-tab>
      <n-tab name="library">内容库</n-tab>
      <n-tab v-if="isAdmin" name="managed">成员内容</n-tab>
    </n-tabs>

    <n-alert v-if="activeScope === 'library'" type="info" :bordered="false">
      内容库遵循当前账号的“显示敏感内容”设置；敏感共享世界书未显示时，请先到设置中开启。
    </n-alert>

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

    <LoadingState
      v-if="activeScope === 'owned' ? worldBookStore.loading : worldBookStore.libraryLoading"
      text="正在加载世界书"
    />

    <ErrorState
      v-else-if="worldBookStore.error"
      title="世界书加载失败"
      :description="worldBookStore.error"
    />

    <section v-else-if="activeScope === 'owned'" class="world-book-workspace">
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
              <span>{{ bindingSummary(worldBook) }}</span>
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
          :character-options="targetCharacterOptions"
          :characters-loading="characterStore.loading"
          :persona-options="personaOptions"
          :conversation-options="conversationOptions"
          :companion-options="companionOptions"
          :bindings-loading="bindingsLoading"
          @submit-book="saveWorldBook"
          @create-entry="createEntry"
          @update-entry="updateEntry"
          @delete-entry="confirmDeleteEntry"
        />
      </section>
    </section>

    <EmptyState
      v-else-if="!worldBookStore.libraryItems.length"
      :title="activeScope === 'library' ? '内容库还没有世界书' : '成员还没有世界书'"
      :description="
        activeScope === 'library'
          ? '管理员尚未发布共享世界书，或共享内容被敏感内容设置隐藏。'
          : '当前还没有成员创建世界书。'
      "
    />

    <section v-else class="world-book-library">
      <n-card
        v-for="worldBook in worldBookStore.libraryItems"
        :key="worldBook.id"
        :title="worldBook.name"
      >
        <p class="world-book-library__description">
          {{ worldBook.description || '未填写描述' }}
        </p>
        <n-space>
          <n-tag :bordered="false">{{ worldBook.entries.length }} 个条目</n-tag>
          <n-tag v-if="worldBook.characterIds.length" type="warning" :bordered="false"
            >需选择目标角色</n-tag
          >
        </n-space>
        <template #footer>
          <n-space justify="space-between">
            <span>{{ worldBook.ownerName ?? '内容库' }}</span>
            <n-tag v-if="activeScope === 'managed'" type="info" :bordered="false">只读</n-tag>
            <n-button
              v-else-if="worldBook.canFork"
              type="primary"
              :loading="worldBookStore.saving"
              @click="prepareLibraryFork(worldBook)"
            >
              复制到我的世界书
            </n-button>
            <n-tag v-else type="success" :bordered="false">管理员主数据</n-tag>
          </n-space>
        </template>
      </n-card>
    </section>

    <n-modal
      v-model:show="targetModalVisible"
      preset="card"
      title="选择成员角色"
      style="width: min(520px, 92vw)"
    >
      <n-space vertical>
        <p>这本世界书在内容库中绑定了角色。复制时必须绑定到你自己的角色，之后不再与主数据同步。</p>
        <n-select
          v-model:value="targetCharacterId"
          :options="targetCharacterOptions"
          placeholder="选择我的角色"
        />
        <n-space justify="end">
          <n-button @click="targetModalVisible = false">取消</n-button>
          <n-button
            type="primary"
            :disabled="!targetCharacterId"
            :loading="worldBookStore.saving"
            @click="confirmLibraryFork"
            >复制</n-button
          >
        </n-space>
      </n-space>
    </n-modal>

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

          <n-form-item label="关联角色">
            <n-select
              v-model:value="createForm.characterIds"
              multiple
              filterable
              clearable
              :loading="characterStore.loading"
              :options="targetCharacterOptions"
              max-tag-count="responsive"
              placeholder="可多选；留空且启用时为全局世界书"
            />
          </n-form-item>

          <n-form-item label="关联 Persona">
            <n-select
              v-model:value="createForm.personaIds"
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
              v-model:value="createForm.conversationIds"
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
              v-model:value="createForm.companionIds"
              multiple
              filterable
              clearable
              :loading="bindingsLoading"
              :options="companionOptions"
              max-tag-count="responsive"
              placeholder="可多选；仅在指定 AI 角色中生效"
            />
          </n-form-item>

          <n-form-item label="描述（仅用于管理说明，不参与匹配或 Prompt 注入）">
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
            <n-checkbox v-if="isAdmin" v-model:checked="createForm.isShared"
              >发布到成员内容库</n-checkbox
            >
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

    <ModuleJsonImportDrawer
      v-model:show="importDrawerVisible"
      title="导入世界书 JSON"
      format-label="tavern-lite.world-book.v2"
      :preview="importPreview"
      :previewing="importPreviewing"
      :importing="importing"
      :error="importError"
      @preview="previewWorldBookImport"
      @commit="commitWorldBookImport"
    />
  </main>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import type {
  WorldBook,
  WorldBookEntry,
  WorldBookEntryMutationPayload,
  WorldBookMutationPayload
} from '../../api/worldBooks';
import { fetchWorldBookImportTemplate, importWorldBookJson } from '../../api/worldBooks';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import ModuleJsonImportDrawer from '../../components/ModuleJsonImportDrawer.vue';
import WorldBookEditor from '../../components/WorldBookEditor.vue';
import { useWorldBookStore } from '../../stores/worldBook';
import { useCharacterStore } from '../../stores/character';
import { downloadJson } from '../../utils/downloadJson';
import { getStoredCurrentUser } from '../../api/auth';
import { fetchPersonas } from '../../api/personas';
import { fetchConversations } from '../../api/conversations';
import { fetchCompanions } from '../../api/companions';
import type {
  ContentLibraryScope,
  ModuleImportDuplicateNameStrategy,
  WorldBookEntryPayload,
  WorldBookImportPreview,
  WorldBookPayload
} from '@tavern/shared';

type CreateWorldBookFormState = {
  name: string;
  characterIds: string[];
  personaIds: string[];
  conversationIds: string[];
  companionIds: string[];
  description: string;
  scanDepth: number;
  tokenBudget: number;
  isEnabled: boolean;
  isShared: boolean;
};

const worldBookStore = useWorldBookStore();
const isAdmin = getStoredCurrentUser()?.role === 'admin';
const characterStore = useCharacterStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(worldBookStore.search);
const drawerVisible = ref(false);
const deletingWorldBookId = ref<string | null>(null);
const deletingEntryId = ref<string | null>(null);
const importDrawerVisible = ref(false);
const importPreview = ref<WorldBookImportPreview | null>(null);
const importError = ref<string | null>(null);
const importPreviewing = ref(false);
const importing = ref(false);
const templateLoading = ref(false);
const createFormRef = ref<FormInst | null>(null);
const editorRef = ref<InstanceType<typeof WorldBookEditor> | null>(null);
const drawerWidth = computed(() => Math.min(620, window.innerWidth));
const createForm = reactive<CreateWorldBookFormState>(createEmptyWorldBookForm());
const activeScope = ref<ContentLibraryScope>('owned');
const targetModalVisible = ref(false);
const targetCharacterId = ref<string | null>(null);
const pendingLibraryWorldBook = ref<WorldBook | null>(null);
const bindingsLoading = ref(false);
const personaOptions = ref<Array<{ label: string; value: string }>>([]);
const conversationOptions = ref<Array<{ label: string; value: string }>>([]);
const companionOptions = ref<Array<{ label: string; value: string }>>([]);
const targetCharacterOptions = computed(() =>
  characterStore.items.map((item) => ({ label: item.name, value: item.id }))
);

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
  void characterStore.loadCharacters({ page: 1, pageSize: 100, isArchived: false });
  void loadBindingTargets();
});

async function loadBindingTargets() {
  bindingsLoading.value = true;
  try {
    const [personas, conversations, companions] = await Promise.all([
      fetchPersonas({ page: 1, pageSize: 100, scope: 'owned' }),
      fetchConversations({ page: 1, pageSize: 100 }),
      fetchCompanions('', 'owned')
    ]);
    personaOptions.value = personas.items.map((item) => ({ label: item.name, value: item.id }));
    conversationOptions.value = conversations.items.map((item) => ({
      label: item.title,
      value: item.id
    }));
    companionOptions.value = companions.items.map((item) => ({ label: item.name, value: item.id }));
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '绑定目标加载失败。');
  } finally {
    bindingsLoading.value = false;
  }
}

function bindingSummary(worldBook: WorldBook) {
  const count =
    worldBook.characterIds.length +
    worldBook.personaIds.length +
    worldBook.conversationIds.length +
    worldBook.companionIds.length;
  return count > 0 ? `关联 ${count} 个目标` : '全局';
}

watch(activeScope, (scope) => {
  if (scope !== 'owned') {
    void worldBookStore.loadLibrary(searchText.value, scope);
  }
  if (scope === 'library') {
    void characterStore.loadCharacters({ page: 1, pageSize: 100, isArchived: false });
  }
});

function applySearch() {
  worldBookStore.setSearch(searchText.value);
  if (activeScope.value !== 'owned') {
    void worldBookStore.loadLibrary(searchText.value, activeScope.value);
    return;
  }
  void worldBookStore.loadWorldBooks({
    page: 1,
    search: searchText.value
  });
}

async function prepareLibraryFork(worldBook: WorldBook) {
  if (worldBook.characterIds.length > 0) {
    pendingLibraryWorldBook.value = worldBook;
    targetCharacterId.value = null;
    targetModalVisible.value = true;
    return;
  }
  await copyLibraryWorldBook(worldBook.id);
}

async function confirmLibraryFork() {
  if (!pendingLibraryWorldBook.value || !targetCharacterId.value) return;
  const copied = await copyLibraryWorldBook(
    pendingLibraryWorldBook.value.id,
    targetCharacterId.value
  );
  if (copied) targetModalVisible.value = false;
}

async function copyLibraryWorldBook(id: string, targetId?: string) {
  const copied = await worldBookStore.forkLibraryWorldBook(id, targetId);
  if (copied) message.success(`已复制“${copied.name}”，后续修改不会与内容库同步。`);
  else if (worldBookStore.saveError) message.error(worldBookStore.saveError);
  return copied;
}

function openCreate() {
  Object.assign(createForm, createEmptyWorldBookForm());
  worldBookStore.saveError = null;
  drawerVisible.value = true;
}

function openImport() {
  importPreview.value = null;
  importError.value = null;
  importDrawerVisible.value = true;
}

async function downloadImportTemplate() {
  templateLoading.value = true;
  try {
    const result = await fetchWorldBookImportTemplate();
    downloadJson(result.fileName, result.template);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '世界书导入模板下载失败。');
  } finally {
    templateLoading.value = false;
  }
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
    characterIds: [...createForm.characterIds],
    personaIds: [...createForm.personaIds],
    conversationIds: [...createForm.conversationIds],
    companionIds: [...createForm.companionIds],
    description: createForm.description.trim(),
    scanDepth: createForm.scanDepth,
    tokenBudget: createForm.tokenBudget,
    isEnabled: createForm.isEnabled,
    ...(isAdmin ? { isShared: createForm.isShared } : {})
  });

  if (!result) {
    return;
  }

  message.success('世界书已创建');
  closeCreate();
}

async function previewWorldBookImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importPreviewing.value = true;
  importError.value = null;

  try {
    const result = await importWorldBookJson(payload.rawJson, {
      commit: false,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });

    importPreview.value = result.preview;
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '世界书 JSON 预览失败。';
  } finally {
    importPreviewing.value = false;
  }
}

async function commitWorldBookImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importing.value = true;
  importError.value = null;

  try {
    const result = await importWorldBookJson(payload.rawJson, {
      commit: true,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });

    await worldBookStore.loadWorldBooks({ page: 1 });

    if (result.worldBook) {
      worldBookStore.selectWorldBook(result.worldBook.id);
    }

    importPreview.value = result.preview;
    importDrawerVisible.value = false;
    message.success(`世界书“${result.preview.name}”已导入`);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '世界书 JSON 导入失败。';
  } finally {
    importing.value = false;
  }
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
    characterIds: [],
    personaIds: [],
    conversationIds: [],
    companionIds: [],
    description: '',
    scanDepth: 6,
    tokenBudget: 1000,
    isEnabled: true,
    isShared: false
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

.world-book-library {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.world-book-library__description {
  display: -webkit-box;
  overflow: hidden;
  min-height: 48px;
  margin: 0 0 14px;
  color: var(--text-muted);
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
