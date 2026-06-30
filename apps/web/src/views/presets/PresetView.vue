<template>
  <main class="preset-view page-shell">
    <header class="page-shell__header preset-view__header">
      <div>
        <h2>参数预设</h2>
        <p>维护对话生成参数和输出风格约束，后续聊天页会从这里选择预设。</p>
      </div>
      <n-button type="primary" @click="openCreate">新建预设</n-button>
    </header>

    <section class="preset-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索预设名称、描述或输出约束"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState v-if="presetStore.loading" text="正在加载参数预设" />

    <ErrorState
      v-else-if="presetStore.error"
      title="参数预设加载失败"
      :description="presetStore.error"
    />

    <EmptyState
      v-else-if="!presetStore.hasPresets"
      title="还没有参数预设"
      description="新建预设后，可以集中维护 Temperature、Top P、Max Tokens 和输出风格约束。"
    />

    <section v-else class="preset-view__grid" aria-label="参数预设列表">
      <n-card
        v-for="preset in presetStore.items"
        :key="preset.id"
        class="preset-card"
        :bordered="false"
      >
        <template #header>
          <div class="preset-card__title">
            <strong>{{ preset.name }}</strong>
            <n-tag v-if="preset.isDefault" size="small" type="success" :bordered="false">
              默认
            </n-tag>
          </div>
        </template>

        <p class="preset-card__description">
          {{ preset.description || '未填写描述' }}
        </p>

        <div class="preset-card__params">
          <n-tag v-for="item in parameterSummary(preset)" :key="item" size="small">
            {{ item }}
          </n-tag>
        </div>

        <section class="preset-card__rules">
          <h3>输出约束</h3>
          <p>{{ preset.outputRules || '未设置输出风格约束' }}</p>
        </section>

        <template #action>
          <n-space justify="end">
            <n-button
              v-if="!preset.isDefault"
              size="small"
              secondary
              type="success"
              :loading="settingDefaultId === preset.id"
              @click="setDefault(preset)"
            >
              设为默认
            </n-button>
            <n-button size="small" secondary @click="openEdit(preset)">编辑</n-button>
            <n-button
              size="small"
              secondary
              type="error"
              :loading="deletingId === preset.id"
              @click="confirmDelete(preset)"
            >
              删除
            </n-button>
          </n-space>
        </template>
      </n-card>
    </section>

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content :title="editingPreset ? '编辑参数预设' : '新建参数预设'">
        <PromptPresetForm
          :initial-value="editingPreset"
          :submitting="presetStore.saving"
          :submit-label="editingPreset ? '保存预设' : '创建预设'"
          :error="presetStore.saveError"
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

import type { PromptPreset, PromptPresetMutationPayload } from '../../api/presets';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import PromptPresetForm from '../../components/PromptPresetForm.vue';
import { usePresetStore } from '../../stores/preset';
import type { PromptPresetPayload } from '@tavern/shared';

const presetStore = usePresetStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(presetStore.search);
const drawerVisible = ref(false);
const editingPreset = ref<PromptPreset | null>(null);
const deletingId = ref<string | null>(null);
const settingDefaultId = ref<string | null>(null);
const drawerWidth = computed(() => Math.min(680, window.innerWidth));

onMounted(() => {
  void presetStore.loadPresets();
});

function applySearch() {
  presetStore.setSearch(searchText.value);
  void presetStore.loadPresets({
    page: 1,
    search: searchText.value
  });
}

function openCreate() {
  editingPreset.value = null;
  presetStore.saveError = null;
  drawerVisible.value = true;
}

function openEdit(preset: PromptPreset) {
  editingPreset.value = preset;
  presetStore.saveError = null;
  drawerVisible.value = true;
}

function closeDrawer() {
  drawerVisible.value = false;
}

async function handleSubmit(payload: PromptPresetPayload | PromptPresetMutationPayload) {
  const result = editingPreset.value
    ? await presetStore.updatePreset(editingPreset.value.id, payload)
    : await presetStore.createPreset(payload as PromptPresetPayload);

  if (!result) {
    return;
  }

  message.success(editingPreset.value ? '参数预设已保存' : '参数预设已创建');
  closeDrawer();
}

function confirmDelete(preset: PromptPreset) {
  dialog.warning({
    title: '删除参数预设',
    content: `确认删除“${preset.name}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deletePreset(preset.id)
  });
}

async function deletePreset(id: string) {
  deletingId.value = id;

  try {
    const deleted = await presetStore.deletePreset(id);

    if (deleted) {
      message.success('参数预设已删除');
    } else if (presetStore.saveError) {
      message.error(presetStore.saveError);
    }
  } finally {
    deletingId.value = null;
  }
}

async function setDefault(preset: PromptPreset) {
  settingDefaultId.value = preset.id;

  try {
    const result = await presetStore.setDefaultPreset(preset.id);

    if (result) {
      message.success(`已将“${preset.name}”设为默认预设`);
    } else if (presetStore.saveError) {
      message.error(presetStore.saveError);
    }
  } finally {
    settingDefaultId.value = null;
  }
}

function parameterSummary(preset: PromptPreset): string[] {
  const items = [
    preset.temperature === null ? null : `temp ${preset.temperature}`,
    preset.topP === null ? null : `topP ${preset.topP}`,
    preset.maxTokens === null ? null : `max ${preset.maxTokens}`
  ].filter(Boolean) as string[];

  return items.length > 0 ? items : ['未设置生成参数'];
}
</script>

<style scoped>
.preset-view {
  align-content: start;
}

.preset-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.preset-view__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 480px) auto;
  gap: 10px;
  align-items: center;
}

.preset-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.preset-card {
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.preset-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.preset-card__title strong {
  overflow: hidden;
  min-width: 0;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-card__description {
  min-height: 24px;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.preset-card__params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.preset-card__rules {
  display: grid;
  gap: 6px;
  margin-top: 16px;
}

.preset-card__rules h3 {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.preset-card__rules p {
  display: -webkit-box;
  overflow: hidden;
  min-height: 44px;
  margin: 0;
  color: var(--text-strong);
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 720px) {
  .preset-view__header,
  .preset-view__toolbar {
    grid-template-columns: 1fr;
  }

  .preset-view__grid {
    grid-template-columns: 1fr;
  }
}
</style>
