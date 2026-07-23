<template>
  <main class="persona-view page-shell">
    <header class="page-shell__header persona-view__header">
      <div>
        <h2>Persona</h2>
        <p>维护用户身份、偏好和表达方式，后续 Prompt Builder 会从这里读取。</p>
      </div>
      <n-space v-if="activeScope === 'owned'" justify="end">
        <n-button secondary :loading="templateLoading" @click="downloadImportTemplate">
          导入模板
        </n-button>
        <n-button secondary @click="openImport">导入 JSON</n-button>
        <n-button type="primary" @click="openCreate">新建 Persona</n-button>
      </n-space>
    </header>

    <n-tabs v-model:value="activeScope" type="segment">
      <n-tab name="owned">我的 Persona</n-tab>
      <n-tab name="library">内容库</n-tab>
      <n-tab v-if="isAdmin" name="managed">成员内容</n-tab>
    </n-tabs>

    <n-alert v-if="activeScope === 'library'" type="info" :bordered="false">
      内容库遵循当前账号的“显示敏感内容”设置；敏感共享 Persona 未显示时，请先到设置中开启。
    </n-alert>

    <section class="persona-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索 Persona 名称、核心身份、背景或互动偏好"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState
      v-if="activeScope === 'owned' ? personaStore.loading : personaStore.libraryLoading"
      text="正在加载 Persona"
    />

    <ErrorState
      v-else-if="personaStore.error"
      title="Persona 加载失败"
      :description="personaStore.error"
    />

    <EmptyState
      v-else-if="!visiblePersonas.length"
      title="还没有 Persona"
      :description="
        activeScope === 'owned'
          ? '新建 Persona 后，可以集中维护用户身份、偏好和对话边界。'
          : activeScope === 'library'
            ? '管理员尚未发布共享 Persona，或共享内容被敏感内容设置隐藏。'
            : '当前还没有成员创建 Persona。'
      "
    />

    <section v-else class="persona-view__grid" aria-label="Persona 列表">
      <n-card
        v-for="persona in visiblePersonas"
        :key="persona.id"
        class="persona-card"
        :bordered="false"
      >
        <template #header>
          <div class="persona-card__title">
            <strong>{{ persona.name }}</strong>
            <n-tag v-if="persona.isDefault" size="small" type="success" :bordered="false">
              默认
            </n-tag>
          </div>
        </template>

        <p class="persona-card__summary">
          {{ personaSummary(persona) }}
        </p>

        <dl class="persona-card__meta">
          <div>
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(persona.updatedAt) }}</dd>
          </div>
          <div>
            <dt>字符数</dt>
            <dd>{{ personaTextLength(persona) }}</dd>
          </div>
        </dl>

        <template #action>
          <n-space v-if="activeScope === 'library'" justify="space-between">
            <n-tag :bordered="false">{{ persona.ownerName ?? '内容库' }}</n-tag>
            <n-button
              v-if="persona.canFork"
              type="primary"
              size="small"
              :loading="personaStore.saving"
              @click="copyFromLibrary(persona.id)"
            >
              复制到我的 Persona
            </n-button>
            <n-tag v-else type="success" :bordered="false">管理员主数据</n-tag>
          </n-space>
          <n-space v-else-if="activeScope === 'managed'" justify="space-between">
            <n-tag :bordered="false">{{ persona.ownerName ?? '成员' }}</n-tag>
            <n-tag type="info" :bordered="false">只读</n-tag>
          </n-space>
          <n-space v-else justify="end">
            <n-button size="small" secondary @click="exportPersona(persona)">导出</n-button>
            <n-button
              v-if="!persona.isDefault"
              size="small"
              secondary
              type="success"
              :loading="settingDefaultId === persona.id"
              @click="setDefault(persona)"
            >
              设为默认
            </n-button>
            <n-button size="small" secondary @click="openEdit(persona)">编辑</n-button>
            <n-button
              size="small"
              secondary
              type="error"
              :loading="deletingId === persona.id"
              @click="confirmDelete(persona)"
            >
              删除
            </n-button>
          </n-space>
        </template>
      </n-card>
    </section>

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content :title="editingPersona ? '编辑 Persona' : '新建 Persona'">
        <PersonaEditor
          :initial-value="editingPersona"
          :submitting="personaStore.saving"
          :submit-label="editingPersona ? '保存 Persona' : '创建 Persona'"
          :error="personaStore.saveError"
          @submit="handleSubmit"
          @cancel="closeDrawer"
        />
      </n-drawer-content>
    </n-drawer>

    <ModuleJsonImportDrawer
      v-model:show="importDrawerVisible"
      title="导入 Persona JSON"
      format-label="tavern-lite.persona.v2"
      :preview="importPreview"
      :previewing="importPreviewing"
      :importing="importing"
      :error="importError"
      @preview="previewPersonaImport"
      @commit="commitPersonaImport"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import {
  exportPersonaJson,
  fetchPersonaImportTemplate,
  importPersonaJson,
  type Persona,
  type PersonaMutationPayload
} from '../../api/personas';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import ModuleJsonImportDrawer from '../../components/ModuleJsonImportDrawer.vue';
import PersonaEditor from '../../components/PersonaEditor.vue';
import { getStoredCurrentUser } from '../../api/auth';
import { usePersonaStore } from '../../stores/persona';
import { downloadJson } from '../../utils/downloadJson';
import type {
  ContentLibraryScope,
  ModuleImportDuplicateNameStrategy,
  PersonaImportPreview,
  PersonaPayload
} from '@tavern/shared';

const personaStore = usePersonaStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(personaStore.search);
const drawerVisible = ref(false);
const editingPersona = ref<Persona | null>(null);
const deletingId = ref<string | null>(null);
const settingDefaultId = ref<string | null>(null);
const importDrawerVisible = ref(false);
const importPreview = ref<PersonaImportPreview | null>(null);
const importError = ref<string | null>(null);
const importPreviewing = ref(false);
const importing = ref(false);
const templateLoading = ref(false);
const isAdmin = getStoredCurrentUser()?.role === 'admin';
const drawerWidth = computed(() => Math.min(680, window.innerWidth));
const activeScope = ref<ContentLibraryScope>('owned');
const visiblePersonas = computed(() =>
  activeScope.value === 'owned' ? personaStore.items : personaStore.libraryItems
);

onMounted(() => {
  void personaStore.loadPersonas();
});

watch(activeScope, (scope) => {
  if (scope !== 'owned') void personaStore.loadLibrary(searchText.value, scope);
});

function applySearch() {
  personaStore.setSearch(searchText.value);
  if (activeScope.value !== 'owned') {
    void personaStore.loadLibrary(searchText.value, activeScope.value);
    return;
  }
  void personaStore.loadPersonas({
    page: 1,
    search: searchText.value
  });
}

async function copyFromLibrary(id: string) {
  const copied = await personaStore.forkLibraryPersona(id);
  if (copied) message.success(`已复制“${copied.name}”，后续修改不会与内容库同步。`);
  else if (personaStore.saveError) message.error(personaStore.saveError);
}

function openCreate() {
  editingPersona.value = null;
  personaStore.saveError = null;
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
    const result = await fetchPersonaImportTemplate();
    downloadJson(result.fileName, result.template);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Persona 导入模板下载失败。');
  } finally {
    templateLoading.value = false;
  }
}

function openEdit(persona: Persona) {
  editingPersona.value = persona;
  personaStore.saveError = null;
  drawerVisible.value = true;
}

async function exportPersona(persona: Persona) {
  try {
    const result = await exportPersonaJson(persona.id);
    downloadJson(result.fileName, result.card);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Persona 导出失败。');
  }
}

function closeDrawer() {
  drawerVisible.value = false;
}

async function handleSubmit(payload: PersonaPayload | PersonaMutationPayload) {
  const result = editingPersona.value
    ? await personaStore.updatePersona(editingPersona.value.id, payload)
    : await personaStore.createPersona(payload as PersonaPayload);

  if (!result) {
    return;
  }

  message.success(editingPersona.value ? 'Persona 已保存' : 'Persona 已创建');
  closeDrawer();
}

async function previewPersonaImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importPreviewing.value = true;
  importError.value = null;

  try {
    const result = await importPersonaJson(payload.rawJson, {
      commit: false,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });

    importPreview.value = result.preview;
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Persona JSON 预览失败。';
  } finally {
    importPreviewing.value = false;
  }
}

async function commitPersonaImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importing.value = true;
  importError.value = null;

  try {
    const result = await importPersonaJson(payload.rawJson, {
      commit: true,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });

    await personaStore.loadPersonas({ page: 1 });
    importPreview.value = result.preview;
    importDrawerVisible.value = false;
    message.success(`Persona“${result.preview.name}”已导入`);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Persona JSON 导入失败。';
  } finally {
    importing.value = false;
  }
}

function confirmDelete(persona: Persona) {
  dialog.warning({
    title: '删除 Persona',
    content: `确认删除“${persona.name}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deletePersona(persona.id)
  });
}

async function deletePersona(id: string) {
  deletingId.value = id;

  try {
    const deleted = await personaStore.deletePersona(id);

    if (deleted) {
      message.success('Persona 已删除');
    } else if (personaStore.saveError) {
      message.error(personaStore.saveError);
    }
  } finally {
    deletingId.value = null;
  }
}

async function setDefault(persona: Persona) {
  settingDefaultId.value = persona.id;

  try {
    const result = await personaStore.setDefaultPersona(persona.id);

    if (result) {
      message.success(`已将“${persona.name}”设为默认 Persona`);
    } else if (personaStore.saveError) {
      message.error(personaStore.saveError);
    }
  } finally {
    settingDefaultId.value = null;
  }
}

function personaSummary(persona: Persona): string {
  const value = [persona.coreIdentity, persona.background, persona.interactionPreferences]
    .find((item) => item.trim())
    ?.trim()
    .replace(/\s+/g, ' ');

  return value || '未填写 Persona 内容';
}

function personaTextLength(persona: Persona): number {
  return [persona.coreIdentity, persona.background, persona.interactionPreferences].reduce(
    (total, item) => total + item.length,
    0
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
</script>

<style scoped>
.persona-view {
  align-content: start;
}

.persona-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.persona-view__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 480px) auto;
  gap: 10px;
  align-items: center;
}

.persona-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.persona-card {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.persona-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.persona-card__title strong {
  overflow: hidden;
  min-width: 0;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-card__summary {
  display: -webkit-box;
  overflow: hidden;
  min-height: 70px;
  margin: 0;
  color: var(--text-strong);
  line-height: 1.6;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.persona-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 16px 0 0;
}

.persona-card__meta div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.persona-card__meta dt {
  color: var(--text-muted);
  font-size: 12px;
}

.persona-card__meta dd {
  margin: 0;
  color: var(--text-strong);
  line-height: 1.5;
}

@media (max-width: 720px) {
  .persona-view__header,
  .persona-view__toolbar {
    grid-template-columns: 1fr;
  }

  .persona-view__grid,
  .persona-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
