<template>
  <main class="page-shell conversation-view">
    <header class="page-shell__header conversation-view__header">
      <div>
        <h2>会话</h2>
        <p>查看角色会话，创建聊天入口，并维护已有会话状态。</p>
      </div>
      <n-button type="primary" :disabled="!characterStore.hasCharacters" @click="openCreate">
        新建会话
      </n-button>
    </header>

    <section class="conversation-view__toolbar">
      <n-input
        v-model:value="searchText"
        clearable
        placeholder="搜索会话标题或角色名称"
        @keyup.enter="applySearch"
        @clear="applySearch"
      />
      <n-button secondary @click="applySearch">搜索</n-button>
    </section>

    <n-alert
      v-if="!characterStore.loading && !characterStore.hasCharacters"
      type="warning"
      :bordered="false"
    >
      需要先创建角色，才能新建会话。
    </n-alert>

    <LoadingState v-if="conversationStore.loading" text="正在加载会话" />

    <ErrorState
      v-else-if="conversationStore.error"
      title="会话加载失败"
      :description="conversationStore.error"
    />

    <EmptyState
      v-else-if="!conversationStore.hasConversations"
      title="还没有会话"
      description="新建会话后，可以从这里进入聊天页。"
    />

    <ConversationList
      v-else
      :conversations="conversationStore.items"
      :active-id="conversationStore.currentId"
      :busy-id="busyId"
      :busy-action="busyAction"
      @select="openConversation"
      @clear="confirmClear"
      @delete="confirmDelete"
    />

    <n-drawer v-model:show="drawerVisible" :width="drawerWidth" placement="right">
      <n-drawer-content title="新建会话">
        <n-form class="conversation-form" label-placement="top">
          <n-form-item label="标题" required>
            <n-input v-model:value="form.title" maxlength="160" placeholder="输入会话标题" />
          </n-form-item>

          <n-form-item label="角色" required>
            <NSelect
              v-model:value="form.characterId"
              filterable
              :options="characterOptions"
              placeholder="选择角色"
              @update:value="handleCharacterSelect"
            />
          </n-form-item>

          <n-form-item label="模型配置">
            <NSelect
              v-model:value="form.modelConfigId"
              clearable
              filterable
              :options="modelOptions"
              placeholder="可选"
            />
          </n-form-item>

          <n-form-item label="Persona">
            <NSelect
              v-model:value="form.personaId"
              clearable
              filterable
              :options="personaOptions"
              placeholder="可选"
            />
          </n-form-item>

          <n-form-item label="参数预设">
            <NSelect
              v-model:value="form.promptPresetId"
              clearable
              filterable
              :options="presetOptions"
              placeholder="可选"
            />
          </n-form-item>

          <n-alert v-if="conversationStore.saveError" type="error" :bordered="false">
            {{ conversationStore.saveError }}
          </n-alert>

          <n-space justify="end">
            <n-button secondary @click="closeDrawer">取消</n-button>
            <n-button type="primary" :loading="conversationStore.saving" @click="submitCreate">
              创建会话
            </n-button>
          </n-space>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { NSelect, type SelectOption, useDialog, useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';

import type { Conversation } from '../../api/conversations';
import ConversationList from '../../components/ConversationList.vue';
import EmptyState from '../../components/EmptyState.vue';
import ErrorState from '../../components/ErrorState.vue';
import LoadingState from '../../components/LoadingState.vue';
import { useCharacterStore } from '../../stores/character';
import { useConversationStore } from '../../stores/conversation';
import { useModelStore } from '../../stores/model';
import { usePersonaStore } from '../../stores/persona';
import { usePresetStore } from '../../stores/preset';
import type { ConversationPayload } from '@tavern/shared';

type ConversationFormState = {
  title: string;
  characterId: string | null;
  modelConfigId: string | null;
  personaId: string | null;
  promptPresetId: string | null;
};

const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const conversationStore = useConversationStore();
const characterStore = useCharacterStore();
const modelStore = useModelStore();
const personaStore = usePersonaStore();
const presetStore = usePresetStore();
const searchText = ref(conversationStore.search);
const drawerVisible = ref(false);
const busyId = ref<string | null>(null);
const busyAction = ref<'clear' | 'delete' | null>(null);
const drawerWidth = computed(() => Math.min(680, window.innerWidth));
const form = reactive<ConversationFormState>({
  title: '',
  characterId: null,
  modelConfigId: null,
  personaId: null,
  promptPresetId: null
});

const characterOptions = computed<SelectOption[]>(() =>
  characterStore.items.map((character) => ({
    label: character.name,
    value: character.id
  }))
);

const modelOptions = computed<SelectOption[]>(() =>
  modelStore.items.map((modelConfig) => ({
    label: `${modelConfig.name} / ${modelConfig.modelName}`,
    value: modelConfig.id
  }))
);

const personaOptions = computed<SelectOption[]>(() =>
  personaStore.items.map((persona) => ({
    label: persona.name,
    value: persona.id
  }))
);

const presetOptions = computed<SelectOption[]>(() =>
  presetStore.items.map((preset) => ({
    label: preset.name,
    value: preset.id
  }))
);

onMounted(() => {
  void loadInitialData();
});

async function loadInitialData() {
  await Promise.allSettled([
    conversationStore.loadConversations(),
    characterStore.loadCharacters({ page: 1, pageSize: 100, search: '' }),
    modelStore.loadModelConfigs({ page: 1, pageSize: 100, search: '' }),
    personaStore.loadPersonas({ page: 1, pageSize: 100, search: '' }),
    presetStore.loadPresets({ page: 1, pageSize: 100, search: '' })
  ]);
}

function applySearch() {
  conversationStore.setSearch(searchText.value);
  void conversationStore.loadConversations({
    page: 1,
    search: searchText.value
  });
}

function openCreate() {
  if (!characterStore.hasCharacters) {
    message.warning('请先创建角色。');

    return;
  }

  resetForm();
  drawerVisible.value = true;
}

function closeDrawer() {
  drawerVisible.value = false;
}

function resetForm() {
  const firstCharacter = characterStore.items[0] ?? null;

  form.characterId = firstCharacter?.id ?? null;
  form.title = firstCharacter ? `${firstCharacter.name} 的会话` : '';
  form.modelConfigId = modelStore.items.find((item) => item.isDefault)?.id ?? null;
  form.personaId = personaStore.items.find((item) => item.isDefault)?.id ?? null;
  form.promptPresetId = presetStore.items.find((item) => item.isDefault)?.id ?? null;
  conversationStore.saveError = null;
}

function handleCharacterSelect(value: string | null) {
  if (!value) {
    return;
  }

  const character = characterStore.items.find((item) => item.id === value);

  if (character && !form.title.trim()) {
    form.title = `${character.name} 的会话`;
  }
}

async function submitCreate() {
  if (!form.title.trim()) {
    message.warning('请输入会话标题。');

    return;
  }

  if (!form.characterId) {
    message.warning('请选择角色。');

    return;
  }

  const payload: ConversationPayload = {
    title: form.title.trim(),
    characterId: form.characterId,
    modelConfigId: form.modelConfigId,
    personaId: form.personaId,
    promptPresetId: form.promptPresetId,
    status: 'active'
  };
  const conversation = await conversationStore.createConversation(payload);

  if (!conversation) {
    return;
  }

  message.success('会话已创建');
  drawerVisible.value = false;
  await openConversation(conversation);
}

async function openConversation(conversation: Conversation) {
  conversationStore.setCurrent(conversation.id);
  await router.push({
    name: 'chat-conversation',
    params: {
      conversationId: conversation.id
    }
  });
}

function confirmClear(conversation: Conversation) {
  dialog.warning({
    title: '清空会话',
    content: `确认清空“${conversation.title}”下的消息？会话本身会保留。`,
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: () => clearConversation(conversation.id)
  });
}

async function clearConversation(id: string) {
  busyId.value = id;
  busyAction.value = 'clear';

  try {
    const cleared = await conversationStore.clearConversation(id);

    if (cleared) {
      message.success('会话消息已清空');
    }
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}

function confirmDelete(conversation: Conversation) {
  dialog.warning({
    title: '删除会话',
    content: `确认删除“${conversation.title}”？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deleteConversation(conversation.id)
  });
}

async function deleteConversation(id: string) {
  busyId.value = id;
  busyAction.value = 'delete';

  try {
    const deleted = await conversationStore.deleteConversation(id);

    if (deleted) {
      message.success('会话已删除');
    }
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
</script>

<style scoped>
.conversation-view {
  align-content: start;
}

.conversation-view__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.conversation-view__toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 480px) auto;
  gap: 10px;
  align-items: center;
}

.conversation-form {
  display: grid;
  gap: 4px;
}

@media (max-width: 720px) {
  .conversation-view__header,
  .conversation-view__toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
