<template>
  <main class="page-shell character-list">
    <header class="page-shell__header character-list__header">
      <div>
        <h2>角色</h2>
        <p>管理本地角色卡，进入详情或编辑后续信息。</p>
      </div>
      <n-space class="character-list__actions" justify="end">
        <input
          ref="fileInputRef"
          class="character-list__file"
          type="file"
          accept="application/json,.json"
          @change="handleFileSelected"
        />
        <n-button secondary :loading="importLoading" @click="openFilePicker">导入 JSON</n-button>
        <n-button type="primary" @click="goCreate">新建角色</n-button>
      </n-space>
    </header>

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

    <n-alert v-if="importError" type="error" :bordered="false">
      {{ importError }}
    </n-alert>

    <section v-if="importPreview" class="character-list__import page-panel">
      <div class="character-list__import-header">
        <div>
          <h3>导入预览</h3>
          <p>{{ selectedFileName || '已读取 JSON 文件' }}</p>
        </div>
        <n-space justify="end">
          <n-button :disabled="importLoading" @click="clearImportPreview">取消</n-button>
          <n-button
            v-if="importPreview.nameConflict"
            type="primary"
            secondary
            :loading="importLoading"
            @click="confirmImport('rename')"
          >
            使用建议名称导入
          </n-button>
          <n-button v-else type="primary" :loading="importLoading" @click="confirmImport('reject')">
            确认导入
          </n-button>
        </n-space>
      </div>

      <n-alert v-if="importPreview.nameConflict" type="warning" :bordered="false">
        已存在同名角色「{{ importPreview.name }}」。默认不会覆盖，可导入为「{{
          importPreview.suggestedName
        }}」。
      </n-alert>

      <div class="character-list__preview-grid">
        <article>
          <span>名称</span>
          <strong>{{ importPreview.name }}</strong>
        </article>
        <article>
          <span>开场白</span>
          <strong>{{ importPreview.firstMessage ? '已映射' : '未提供' }}</strong>
        </article>
        <article>
          <span>示例对话</span>
          <strong>{{ importPreview.exampleMessages.length }} 条</strong>
        </article>
        <article>
          <span>元数据</span>
          <strong>{{ metadataFieldCount }} 项</strong>
        </article>
      </div>

      <div class="character-list__preview-body">
        <section>
          <h4>核心字段</h4>
          <dl>
            <div>
              <dt>描述</dt>
              <dd>{{ fallback(importPreview.description) }}</dd>
            </div>
            <div>
              <dt>人格</dt>
              <dd>{{ fallback(importPreview.personality) }}</dd>
            </div>
            <div>
              <dt>场景</dt>
              <dd>{{ fallback(importPreview.scenario) }}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>字段映射</h4>
          <div class="character-list__mapping">
            <n-tag
              v-for="mapping in importPreview.fieldMappings"
              :key="`${mapping.source}-${mapping.target ?? mapping.action}`"
              :type="mapping.action === 'ignored' ? 'warning' : 'default'"
              :bordered="false"
            >
              {{ mapping.source }} -> {{ mapping.target ?? '忽略' }}
            </n-tag>
          </div>
        </section>
      </div>

      <n-alert
        v-if="importPreview.warnings.length > 0"
        class="character-list__warnings"
        type="warning"
        :bordered="false"
      >
        <ul>
          <li v-for="warning in importPreview.warnings" :key="`${warning.code}-${warning.field}`">
            {{ warning.message }}
          </li>
        </ul>
      </n-alert>
    </section>

    <LoadingState v-if="characterStore.loading" text="正在加载角色" />

    <ErrorState
      v-else-if="characterStore.error"
      title="角色列表加载失败"
      :description="characterStore.error"
    />

    <EmptyState
      v-else-if="!characterStore.hasCharacters"
      title="还没有角色"
      description="创建第一个角色后，它会出现在这里。"
    />

    <section v-else class="character-list__grid" aria-label="角色列表">
      <CharacterCard
        v-for="character in characterStore.items"
        :key="character.id"
        :character="character"
        @view="goDetail"
        @edit="goEdit"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import type { CharacterImportDuplicateNameStrategy, CharacterImportPreview } from '@tavern/shared';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import CharacterCard from '../../components/CharacterCard.vue';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { importCharacterJson } from '../../api/characters';
import { useCharacterStore } from '../../stores/character';

const router = useRouter();
const characterStore = useCharacterStore();
const searchText = ref(characterStore.search);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedRawJson = ref('');
const selectedFileName = ref('');
const importPreview = ref<CharacterImportPreview | null>(null);
const importLoading = ref(false);
const importError = ref<string | null>(null);

const metadataFieldCount = computed(() =>
  importPreview.value ? Object.keys(importPreview.value.metadata).length : 0
);

onMounted(() => {
  void characterStore.loadCharacters();
});

function applySearch() {
  characterStore.setSearch(searchText.value);
  void characterStore.loadCharacters({
    page: 1,
    search: searchText.value
  });
}

function goCreate() {
  router.push({ name: 'character-create' });
}

function openFilePicker() {
  fileInputRef.value?.click();
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;

  input.value = '';

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
    importError.value = '请选择 JSON 角色卡文件。';
    importPreview.value = null;
    return;
  }

  importLoading.value = true;
  importError.value = null;
  selectedFileName.value = file.name;

  try {
    selectedRawJson.value = await file.text();
    const result = await importCharacterJson({
      rawJson: selectedRawJson.value
    });

    importPreview.value = result.preview;
  } catch (error) {
    importPreview.value = null;
    importError.value = error instanceof Error ? error.message : '角色卡导入预览失败。';
  } finally {
    importLoading.value = false;
  }
}

async function confirmImport(strategy: CharacterImportDuplicateNameStrategy) {
  if (!selectedRawJson.value || !importPreview.value) {
    return;
  }

  importLoading.value = true;
  importError.value = null;

  try {
    const result = await importCharacterJson({
      rawJson: selectedRawJson.value,
      commit: true,
      duplicateNameStrategy: strategy
    });

    clearImportPreview();
    await characterStore.loadCharacters({ page: 1 });

    if (result.character) {
      router.push({ name: 'character-detail', params: { id: result.character.id } });
    }
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '角色卡导入失败。';
  } finally {
    importLoading.value = false;
  }
}

function clearImportPreview() {
  selectedRawJson.value = '';
  selectedFileName.value = '';
  importPreview.value = null;
  importError.value = null;
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
