<template>
  <main class="persona-view page-shell">
    <header class="page-shell__header persona-view__header">
      <div>
        <h2>Persona</h2>
        <p>维护用户身份、偏好和表达方式，后续 Prompt Builder 会从这里读取。</p>
      </div>
      <n-button type="primary" @click="openCreate">新建 Persona</n-button>
    </header>

    <section class="persona-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索 Persona 名称或内容"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <LoadingState v-if="personaStore.loading" text="正在加载 Persona" />

    <ErrorState
      v-else-if="personaStore.error"
      title="Persona 加载失败"
      :description="personaStore.error"
    />

    <EmptyState
      v-else-if="!personaStore.hasPersonas"
      title="还没有 Persona"
      description="新建 Persona 后，可以集中维护用户身份、偏好和对话边界。"
    />

    <section v-else class="persona-view__grid" aria-label="Persona 列表">
      <n-card
        v-for="persona in personaStore.items"
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
            <dd>{{ persona.content.length }}</dd>
          </div>
        </dl>

        <template #action>
          <n-space justify="end">
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
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import type { Persona, PersonaMutationPayload } from '../../api/personas';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import PersonaEditor from '../../components/PersonaEditor.vue';
import { usePersonaStore } from '../../stores/persona';
import type { PersonaPayload } from '@tavern/shared';

const personaStore = usePersonaStore();
const dialog = useDialog();
const message = useMessage();
const searchText = ref(personaStore.search);
const drawerVisible = ref(false);
const editingPersona = ref<Persona | null>(null);
const deletingId = ref<string | null>(null);
const settingDefaultId = ref<string | null>(null);
const drawerWidth = computed(() => Math.min(680, window.innerWidth));

onMounted(() => {
  void personaStore.loadPersonas();
});

function applySearch() {
  personaStore.setSearch(searchText.value);
  void personaStore.loadPersonas({
    page: 1,
    search: searchText.value
  });
}

function openCreate() {
  editingPersona.value = null;
  personaStore.saveError = null;
  drawerVisible.value = true;
}

function openEdit(persona: Persona) {
  editingPersona.value = persona;
  personaStore.saveError = null;
  drawerVisible.value = true;
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
  const value = persona.content.trim().replace(/\s+/g, ' ');

  return value || '未填写 Persona 内容';
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
