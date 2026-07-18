<template>
  <main class="page-shell character-list">
    <header class="page-shell__header character-list__header">
      <div>
        <h2>角色</h2>
        <p>管理本地角色卡，进入详情或编辑后续信息。</p>
      </div>
      <n-space v-if="activeScope === 'owned'" class="character-list__actions" justify="end">
        <n-button secondary :loading="templateLoading" @click="downloadImportTemplate">
          导入模板
        </n-button>
        <n-button secondary @click="openImport">导入 JSON</n-button>
        <n-button type="primary" @click="goCreate">新建角色</n-button>
      </n-space>
    </header>

    <n-tabs v-model:value="activeScope" type="segment">
      <n-tab name="owned">我的角色</n-tab>
      <n-tab name="library">内容库</n-tab>
    </n-tabs>

    <section class="character-list__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索名称、简介、性格或场景"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState
      v-if="activeScope === 'owned' ? characterStore.loading : characterStore.libraryLoading"
      text="正在加载角色"
    />

    <ErrorState
      v-else-if="characterStore.error"
      title="角色列表加载失败"
      :description="characterStore.error"
    />

    <EmptyState
      v-else-if="
        activeScope === 'owned'
          ? !characterStore.hasCharacters
          : !characterStore.libraryItems.length
      "
      title="还没有角色"
      :description="
        activeScope === 'owned' ? '创建第一个角色后，它会出现在这里。' : '管理员尚未发布共享角色。'
      "
    />

    <section v-else-if="activeScope === 'owned'" class="character-list__grid" aria-label="角色列表">
      <CharacterCard
        v-for="character in characterStore.items"
        :key="character.id"
        :character="character"
        @view="goDetail"
        @edit="goEdit"
      />
    </section>

    <section v-else class="character-list__grid" aria-label="角色内容库">
      <n-card
        v-for="character in characterStore.libraryItems"
        :key="character.id"
        :title="character.name"
      >
        <p>{{ fallback(character.description) }}</p>
        <template #footer>
          <n-space justify="space-between">
            <n-tag :bordered="false">{{ character.ownerName ?? '内容库' }}</n-tag>
            <n-button
              v-if="character.canFork"
              type="primary"
              :loading="characterStore.saving"
              @click="copyFromLibrary(character.id)"
            >
              复制到我的角色
            </n-button>
            <n-tag v-else type="success" :bordered="false">管理员主数据</n-tag>
          </n-space>
        </template>
      </n-card>
    </section>

    <ModuleJsonImportDrawer
      v-model:show="importDrawerVisible"
      title="导入角色卡 JSON"
      format-label="chara_card_v2"
      :preview="importPreview"
      :previewing="importPreviewing"
      :importing="importing"
      :error="importError"
      @preview="previewCharacterImport"
      @commit="commitCharacterImport"
    >
      <template #preview-details="{ preview }">
        <div class="character-import-details">
          <dl>
            <div>
              <dt>描述</dt>
              <dd>{{ fallback(preview.description) }}</dd>
            </div>
            <div>
              <dt>人格</dt>
              <dd>{{ fallback(preview.personality) }}</dd>
            </div>
            <div>
              <dt>场景</dt>
              <dd>{{ fallback(preview.scenario) }}</dd>
            </div>
          </dl>
          <div class="character-list__mapping">
            <n-tag
              v-for="mapping in preview.fieldMappings"
              :key="`${mapping.source}-${mapping.target ?? mapping.action}`"
              :type="mapping.action === 'ignored' ? 'warning' : 'default'"
              :bordered="false"
              >{{ mapping.source }} -> {{ mapping.target ?? '忽略' }}</n-tag
            >
          </div>
        </div>
      </template>
    </ModuleJsonImportDrawer>
  </main>
</template>

<script setup lang="ts">
import type {
  CharacterImportPreview,
  ContentLibraryScope,
  ModuleImportDuplicateNameStrategy
} from '@tavern/shared';
import { useMessage } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import CharacterCard from '../../components/CharacterCard.vue';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import ModuleJsonImportDrawer from '../../components/ModuleJsonImportDrawer.vue';
import { fetchCharacterImportTemplate, importCharacterJson } from '../../api/characters';
import { useCharacterStore } from '../../stores/character';
import { downloadJson } from '../../utils/downloadJson';

const router = useRouter();
const characterStore = useCharacterStore();
const message = useMessage();
const searchText = ref(characterStore.search);
const importDrawerVisible = ref(false);
const importPreview = ref<CharacterImportPreview | null>(null);
const importPreviewing = ref(false);
const importing = ref(false);
const importError = ref<string | null>(null);
const templateLoading = ref(false);
const activeScope = ref<ContentLibraryScope>('owned');

onMounted(() => {
  void characterStore.loadCharacters();
});

watch(activeScope, (scope) => {
  if (scope === 'library') void characterStore.loadLibrary(searchText.value);
});

function applySearch() {
  characterStore.setSearch(searchText.value);
  if (activeScope.value === 'library') {
    void characterStore.loadLibrary(searchText.value);
    return;
  }
  void characterStore.loadCharacters({
    page: 1,
    search: searchText.value
  });
}

async function copyFromLibrary(id: string) {
  const copied = await characterStore.forkLibraryCharacter(id);
  if (copied) message.success(`已复制「${copied.name}」，后续修改不会与内容库同步。`);
  else if (characterStore.saveError) message.error(characterStore.saveError);
}

function goCreate() {
  router.push({ name: 'character-create' });
}

function openImport() {
  importPreview.value = null;
  importError.value = null;
  importDrawerVisible.value = true;
}

async function downloadImportTemplate() {
  templateLoading.value = true;
  try {
    const result = await fetchCharacterImportTemplate();
    downloadJson(result.fileName, result.template);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '角色卡导入模板下载失败。');
  } finally {
    templateLoading.value = false;
  }
}

async function previewCharacterImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importPreviewing.value = true;
  importError.value = null;
  try {
    const result = await importCharacterJson({
      rawJson: payload.rawJson,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });
    importPreview.value = result.preview;
  } catch (error) {
    importPreview.value = null;
    importError.value = error instanceof Error ? error.message : '角色卡导入预览失败。';
  } finally {
    importPreviewing.value = false;
  }
}

async function commitCharacterImport(payload: {
  rawJson: string;
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy;
}) {
  importing.value = true;
  importError.value = null;
  try {
    const result = await importCharacterJson({
      rawJson: payload.rawJson,
      commit: true,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });
    await characterStore.loadCharacters({ page: 1 });
    importDrawerVisible.value = false;
    importPreview.value = result.preview;
    if (result.character) {
      router.push({ name: 'character-detail', params: { id: result.character.id } });
    }
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '角色卡导入失败。';
  } finally {
    importing.value = false;
  }
}

function goDetail(id: string) {
  router.push({ name: 'character-detail', params: { id } });
}

function goEdit(id: string) {
  router.push({ name: 'character-edit', params: { id } });
}

function fallback(value: string) {
  return value.trim() || '未提供';
}
</script>

<style scoped>
.character-list {
  align-content: start;
}

.character-list__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.character-list__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 420px) auto;
  gap: 10px;
  align-items: center;
}

.character-list__actions {
  flex-wrap: wrap;
}

.character-list__file {
  display: none;
}

.character-list__import {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.character-list__import-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.character-list__import-header h3,
.character-list__preview-body h4 {
  margin: 0;
  color: var(--text-strong);
}

.character-list__import-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.character-list__preview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.character-list__preview-grid article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
}

.character-list__preview-grid span,
.character-list__preview-body dt {
  color: var(--text-muted);
  font-size: 12px;
}

.character-list__preview-grid strong {
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 14px;
}

.character-list__preview-body {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 18px;
}

.character-list__preview-body section,
.character-list__preview-body dl {
  display: grid;
  gap: 10px;
}

.character-list__preview-body dl {
  margin: 0;
}

.character-list__preview-body div {
  display: grid;
  gap: 4px;
}

.character-list__preview-body dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: var(--text-strong);
}

.character-list__mapping {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.character-import-details {
  display: grid;
  gap: 14px;
}

.character-import-details dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.character-import-details dl div {
  display: grid;
  gap: 4px;
}

.character-import-details dt {
  color: var(--text-muted);
  font-size: 12px;
}

.character-import-details dd {
  margin: 0;
  color: var(--text-strong);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.character-list__warnings {
  margin-top: 2px;
}

.character-list__warnings ul {
  margin: 0;
  padding-left: 18px;
}

.character-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

@media (max-width: 720px) {
  .character-list__header,
  .character-list__toolbar,
  .character-list__import-header,
  .character-list__preview-body,
  .character-list__preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
