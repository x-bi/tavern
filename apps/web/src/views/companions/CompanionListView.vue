<template>
  <main class="page-shell">
    <header class="page-shell__header companion-head">
      <div>
        <h2>AI 角色</h2>
        <p>每个角色只有一条持续的关系线程。</p>
      </div>
      <n-space v-if="activeScope === 'owned'" justify="end">
        <n-button secondary :loading="templateLoading" @click="downloadImportTemplate"
          >导入模板</n-button
        >
        <n-button secondary @click="openImport">导入角色</n-button>
        <n-button type="primary" @click="showCreate = !showCreate">新建 AI 角色</n-button>
      </n-space>
    </header>
    <n-tabs v-model:value="activeScope" type="segment">
      <n-tab name="owned">我的 AI 角色</n-tab>
      <n-tab name="library">内容库</n-tab>
      <n-tab v-if="isAdmin" name="managed">成员内容</n-tab>
    </n-tabs>
    <n-alert v-if="activeScope === 'library'" type="info" :bordered="false">
      内容库遵循当前账号的“显示敏感内容”设置；敏感共享 AI 角色未显示时，请先到设置中开启。
    </n-alert>
    <n-card v-if="activeScope === 'owned' && showCreate" title="新建 AI 角色"
      ><n-form
        ><n-form-item label="名字"
          ><n-input v-model:value="draft.name" maxlength="80" /></n-form-item
        ><n-form-item label="初始身份设定"
          ><n-input v-model:value="draft.identityPrompt" type="textarea" :rows="5" /></n-form-item
        ><n-form-item label="核心身份"
          ><n-input v-model:value="draft.coreIdentity" type="textarea" :rows="3" /></n-form-item
        ><n-form-item label="稳定性格"
          ><n-input v-model:value="draft.personality" type="textarea" :rows="2" /></n-form-item
        ><n-form-item label="说话方式"
          ><n-input v-model:value="draft.speechStyle" type="textarea" :rows="2" /></n-form-item
        ><n-form-item label="关系默认值"
          ><n-input
            v-model:value="draft.relationshipDefaults"
            type="textarea"
            :rows="2" /></n-form-item
        ><n-form-item label="聊天模型链"
          ><NSelect
            v-model:value="draft.modelFallbackGroupId"
            clearable
            :options="modelOptions"
            placeholder="使用默认模型链" /></n-form-item
        ><n-form-item label="Prompt 预设"
          ><NSelect
            v-model:value="draft.promptPresetId"
            clearable
            :options="presetOptions" /></n-form-item
        ><n-form-item label="Persona"
          ><NSelect
            v-model:value="draft.personaId"
            clearable
            :options="personaOptions" /></n-form-item
        ><n-form-item label="头像"
          ><input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            @change="pickAvatar"
          /><span v-if="avatarName" class="avatar-name">{{ avatarName }}</span></n-form-item
        ><n-form-item
          ><n-checkbox v-model:checked="draft.isSensitive">敏感内容</n-checkbox></n-form-item
        ><n-form-item v-if="isAdmin"
          ><n-checkbox v-model:checked="draft.isShared">发布到成员内容库</n-checkbox></n-form-item
        ><n-space justify="end"
          ><n-button @click="showCreate = false">取消</n-button
          ><n-button type="primary" :loading="saving" @click="save"
            >创建并进入聊天</n-button
          ></n-space
        ></n-form
      ></n-card
    >
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <n-spin v-if="loading" />
    <section v-else class="companion-grid">
      <n-empty
        v-if="!visibleItems.length"
        :description="
          activeScope === 'owned'
            ? '还没有 AI 角色。'
            : activeScope === 'library'
              ? '管理员尚未发布共享 AI 角色，或共享内容被敏感内容设置隐藏。'
              : '当前还没有成员创建 AI 角色。'
        "
      />
      <n-card
        v-for="item in visibleItems"
        :key="item.id"
        :hoverable="activeScope === 'owned'"
        class="companion-card"
        :class="{ 'companion-card--interactive': activeScope === 'owned' }"
        @click="activeScope === 'owned' ? open(item.id) : undefined"
        ><div class="companion-card__body">
          <n-avatar round :size="52" :src="item.avatarUrl || undefined">{{
            item.name.slice(0, 1)
          }}</n-avatar>
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.identityPrompt || '还没有身份设定' }}</p>
            <n-tag
              size="small"
              :type="item.memoryEnabled ? 'success' : 'default'"
              v-if="activeScope === 'owned'"
              >记忆{{
                item.memoryEnabled ? (item.memoryPaused ? '已暂停' : '已开启') : '未开启'
              }}</n-tag
            >
            <n-space v-if="activeScope === 'owned'" size="small" class="companion-card__actions">
              <n-button size="tiny" quaternary @click.stop="openSettings(item.id)"
                >记忆与设置</n-button
              >
              <n-button size="tiny" quaternary @click.stop="downloadCompanion(item.id)"
                >导出</n-button
              >
              <n-button
                size="tiny"
                quaternary
                :loading="busyId === item.id && busyAction === 'duplicate'"
                :disabled="busyId !== null"
                @click.stop="copyOwned(item)"
                >复制</n-button
              >
              <n-button
                size="tiny"
                quaternary
                type="error"
                :loading="busyId === item.id && busyAction === 'delete'"
                :disabled="busyId !== null"
                @click.stop="confirmDelete(item)"
                >删除</n-button
              >
            </n-space>
            <n-space v-else align="center">
              <n-tag size="small" :bordered="false">{{ item.ownerName ?? '内容库' }}</n-tag>
              <n-tag v-if="activeScope === 'managed'" type="info" :bordered="false">只读</n-tag>
              <n-button
                v-else-if="item.canFork"
                size="small"
                type="primary"
                :loading="saving"
                @click.stop="copyFromLibrary(item.id)"
              >
                复制到我的 AI 角色
              </n-button>
              <n-tag v-else type="success" :bordered="false">管理员主数据</n-tag>
            </n-space>
          </div>
        </div></n-card
      >
    </section>
    <ModuleJsonImportDrawer
      v-model:show="importDrawerVisible"
      title="导入 AI 角色 JSON"
      format-label="tavern-lite.companion.v1 / chara_card_v2"
      :preview="importPreview"
      :previewing="importPreviewing"
      :importing="importing"
      :error="importError || null"
      @preview="previewCompanionImport"
      @commit="commitCompanionImport"
    >
      <template #preview-details="{ preview }">
        <div class="companion-import-details">
          <span>身份设定</span>
          <p>{{ preview.identityPrompt || '未提供' }}</p>
        </div>
      </template>
    </ModuleJsonImportDrawer>
  </main>
</template>
<script setup lang="ts">
import type {
  CompanionImportPreview,
  CompanionResponse,
  ContentLibraryScope
} from '@tavern/shared';
import { NSelect, type SelectOption, useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { uploadAsset } from '../../api/assets';
import { getStoredCurrentUser } from '../../api/auth';
import {
  createCompanion,
  deleteCompanion,
  duplicateCompanion,
  exportCompanionJson,
  fetchCompanionImportTemplate,
  fetchCompanions,
  forkCompanion,
  importCompanionJson
} from '../../api/companions';
import { fetchModelFallbackGroups } from '../../api/models';
import { fetchPersonas } from '../../api/personas';
import { fetchPromptPresets } from '../../api/presets';
import ModuleJsonImportDrawer from '../../components/ModuleJsonImportDrawer.vue';
const router = useRouter();
const dialog = useDialog();
const message = useMessage();
const isAdmin = getStoredCurrentUser()?.role === 'admin';
const items = ref<CompanionResponse[]>([]);
const libraryItems = ref<CompanionResponse[]>([]);
const activeScope = ref<ContentLibraryScope>('owned');
const visibleItems = computed(() =>
  activeScope.value === 'owned' ? items.value : libraryItems.value
);
const loading = ref(false);
const saving = ref(false);
const busyId = ref<string | null>(null);
const busyAction = ref<'duplicate' | 'delete' | null>(null);
const error = ref('');
const showCreate = ref(false);
const draft = reactive({
  name: '',
  identityPrompt: '',
  coreIdentity: '',
  personality: '',
  speechStyle: '',
  relationshipDefaults: '',
  modelFallbackGroupId: null as string | null,
  promptPresetId: null as string | null,
  personaId: null as string | null,
  isSensitive: false,
  isShared: false
});
const avatarFile = ref<File | null>(null);
const avatarName = ref('');
const modelOptions = ref<SelectOption[]>([]);
const presetOptions = ref<SelectOption[]>([]);
const personaOptions = ref<SelectOption[]>([]);
const importDrawerVisible = ref(false);
const importPreviewing = ref(false);
const importing = ref(false);
const importError = ref('');
const templateLoading = ref(false);
const importPreview = ref<CompanionImportPreview | null>(null);
onMounted(load);
watch(activeScope, (scope) => {
  if (scope !== 'owned') void loadLibrary(scope);
});
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [companions, models, presets, personas] = await Promise.all([
      fetchCompanions(),
      fetchModelFallbackGroups({ pageSize: 100, isEnabled: true }),
      fetchPromptPresets({ pageSize: 100 }),
      fetchPersonas({ pageSize: 100 })
    ]);
    items.value = companions.items;
    modelOptions.value = models.items.map((item) => ({ label: item.name, value: item.id }));
    presetOptions.value = presets.items.map((item) => ({ label: item.name, value: item.id }));
    personaOptions.value = personas.items.map((item) => ({ label: item.name, value: item.id }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}
async function loadLibrary(scope: Exclude<ContentLibraryScope, 'owned'>) {
  loading.value = true;
  error.value = '';
  try {
    libraryItems.value = (await fetchCompanions('', scope)).items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '内容库加载失败';
  } finally {
    loading.value = false;
  }
}
function pickAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  avatarFile.value = file;
  avatarName.value = file?.name ?? '';
}
async function save() {
  if (!draft.name.trim()) return;
  saving.value = true;
  try {
    const asset = avatarFile.value ? await uploadAsset(avatarFile.value) : null;
    const item = await createCompanion({
      name: draft.name,
      identityPrompt: draft.identityPrompt,
      coreIdentity: draft.coreIdentity,
      personality: draft.personality,
      speechStyle: draft.speechStyle,
      relationshipDefaults: draft.relationshipDefaults,
      avatarAssetId: asset?.id ?? null,
      modelFallbackGroupId: draft.modelFallbackGroupId,
      promptPresetId: draft.promptPresetId,
      personaId: draft.personaId,
      isSensitive: draft.isSensitive,
      ...(isAdmin ? { isShared: draft.isShared } : {})
    });
    await router.push(`/companion/${item.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    saving.value = false;
  }
}
async function copyFromLibrary(id: string) {
  saving.value = true;
  error.value = '';
  try {
    await forkCompanion(id);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'AI 角色复制失败';
  } finally {
    saving.value = false;
  }
}
async function copyOwned(item: CompanionResponse) {
  busyId.value = item.id;
  busyAction.value = 'duplicate';
  error.value = '';
  try {
    const copied = await duplicateCompanion(item.id);
    items.value = [copied, ...items.value];
    message.success(`已复制为「${copied.name}」，聊天记录和长期记忆未复制。`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'AI 角色复制失败';
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
function confirmDelete(item: CompanionResponse) {
  dialog.warning({
    title: '删除 AI 角色',
    content: `确认删除「${item.name}」？删除后角色、聊天、长期记忆和分享入口将不再可访问。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => removeOwned(item)
  });
}
async function removeOwned(item: CompanionResponse) {
  busyId.value = item.id;
  busyAction.value = 'delete';
  error.value = '';
  try {
    await deleteCompanion(item.id);
    items.value = items.value.filter((candidate) => candidate.id !== item.id);
    message.success(`已删除「${item.name}」。`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'AI 角色删除失败';
  } finally {
    busyId.value = null;
    busyAction.value = null;
  }
}
function open(id: string) {
  void router.push(`/companion/${id}`);
}
function openSettings(id: string) {
  void router.push({ path: `/companion/${id}`, query: { panel: 'memory' } });
}
function openImport() {
  importPreview.value = null;
  importError.value = '';
  importDrawerVisible.value = true;
}
async function previewCompanionImport(payload: {
  rawJson: string;
  duplicateNameStrategy: 'reject' | 'rename';
}) {
  importPreviewing.value = true;
  importError.value = '';
  try {
    importPreview.value = (await importCompanionJson(payload)).preview;
  } catch (e) {
    importPreview.value = null;
    importError.value = e instanceof Error ? e.message : '角色导入预览失败';
  } finally {
    importPreviewing.value = false;
  }
}
async function commitCompanionImport(payload: {
  rawJson: string;
  duplicateNameStrategy: 'reject' | 'rename';
}) {
  importing.value = true;
  importError.value = '';
  try {
    const result = await importCompanionJson({
      rawJson: payload.rawJson,
      commit: true,
      duplicateNameStrategy: payload.duplicateNameStrategy
    });
    importPreview.value = result.preview;
    importDrawerVisible.value = false;
    if (result.companion) await router.push(`/companion/${result.companion.id}`);
  } catch (e) {
    importError.value = e instanceof Error ? e.message : '角色导入失败';
  } finally {
    importing.value = false;
  }
}
async function downloadImportTemplate() {
  templateLoading.value = true;
  try {
    const result = await fetchCompanionImportTemplate();
    downloadJson(result.fileName, result.template);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '模板下载失败';
  } finally {
    templateLoading.value = false;
  }
}
async function downloadCompanion(id: string) {
  try {
    const result = await exportCompanionJson(id);
    downloadJson(result.fileName, result.card);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '角色导出失败';
  }
}
function downloadJson(fileName: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
</script>
<style scoped>
.companion-head {
  grid-template-columns: 1fr auto;
  align-items: center;
}
.companion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.companion-card {
  height: 100%;
}
.companion-card--interactive {
  cursor: pointer;
}
.companion-card__body {
  display: flex;
  gap: 14px;
}
.companion-card__body > div {
  min-width: 0;
}
.companion-card__actions {
  margin-top: 8px;
}
.companion-card h3 {
  margin: 0 0 6px;
  overflow-wrap: anywhere;
}
.companion-card p {
  margin: 0 0 10px;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.avatar-name {
  margin-left: 10px;
  color: var(--text-muted);
}
.companion-import-details {
  display: grid;
  gap: 6px;
}
.companion-import-details span,
.companion-import-details p {
  color: var(--text-muted);
  font-size: 12px;
}
.companion-import-details p {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
