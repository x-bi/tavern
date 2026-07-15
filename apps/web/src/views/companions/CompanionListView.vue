<template>
  <main class="page-shell">
    <header class="page-shell__header companion-head">
      <div>
        <h2>AI 角色</h2>
        <p>每个角色只有一条持续的关系线程。</p>
      </div>
      <n-space justify="end">
        <input
          ref="importInputRef"
          class="companion-list__file"
          type="file"
          accept="application/json,.json"
          @change="handleImportFile"
        />
        <n-button secondary :loading="templateLoading" @click="downloadImportTemplate"
          >导入模板</n-button
        >
        <n-button secondary :loading="importLoading" @click="openImportPicker">导入角色</n-button>
        <n-button type="primary" @click="showCreate = !showCreate">新建 AI 角色</n-button>
      </n-space>
    </header>
    <n-card v-if="showCreate" title="新建 AI 角色"
      ><n-form
        ><n-form-item label="名字"
          ><n-input v-model:value="draft.name" maxlength="80" /></n-form-item
        ><n-form-item label="初始身份设定"
          ><n-input v-model:value="draft.identityPrompt" type="textarea" :rows="5" /></n-form-item
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
        ><n-space justify="end"
          ><n-button @click="showCreate = false">取消</n-button
          ><n-button type="primary" :loading="saving" @click="save"
            >创建并进入聊天</n-button
          ></n-space
        ></n-form
      ></n-card
    >
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <section v-if="importPreview" class="companion-import page-panel">
      <div>
        <h3>导入预览</h3>
        <p>{{ importFileName }} · {{ importPreview.format }}</p>
      </div>
      <n-alert v-if="importPreview.nameConflict" type="warning" :bordered="false">
        已存在同名角色「{{ importPreview.name }}」，将导入为「{{ importPreview.suggestedName }}」。
      </n-alert>
      <n-form-item label="角色名称"><n-input :value="importPreview.name" disabled /></n-form-item>
      <n-form-item label="身份设定"
        ><n-input
          :value="importPreview.identityPrompt || '未提供'"
          type="textarea"
          :rows="4"
          disabled
      /></n-form-item>
      <n-alert v-if="importPreview.warnings.length" type="info" :bordered="false">{{
        importPreview.warnings.join(' ')
      }}</n-alert>
      <n-space justify="end"
        ><n-button @click="clearImport">取消</n-button
        ><n-button type="primary" :loading="importLoading" @click="confirmImport"
          >确认导入</n-button
        ></n-space
      >
    </section>
    <n-spin v-if="loading" />
    <section v-else class="companion-grid">
      <n-card
        v-for="item in items"
        :key="item.id"
        hoverable
        class="companion-card"
        @click="open(item.id)"
        ><div class="companion-card__body">
          <n-avatar round :size="52" :src="item.avatarUrl || undefined">{{
            item.name.slice(0, 1)
          }}</n-avatar>
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.identityPrompt || '还没有身份设定' }}</p>
            <n-tag size="small" :type="item.memoryEnabled ? 'success' : 'default'"
              >记忆{{
                item.memoryEnabled ? (item.memoryPaused ? '已暂停' : '已开启') : '未开启'
              }}</n-tag
            >
            <n-button size="tiny" quaternary @click.stop="downloadCompanion(item.id)"
              >导出</n-button
            >
          </div>
        </div></n-card
      >
    </section>
  </main>
</template>
<script setup lang="ts">
import type { CompanionImportPreview, CompanionResponse } from '@tavern/shared';
import { NSelect, type SelectOption } from 'naive-ui';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { uploadAsset } from '../../api/assets';
import {
  createCompanion,
  exportCompanionJson,
  fetchCompanionImportTemplate,
  fetchCompanions,
  importCompanionJson
} from '../../api/companions';
import { fetchModelFallbackGroups } from '../../api/models';
import { fetchPersonas } from '../../api/personas';
import { fetchPromptPresets } from '../../api/presets';
const router = useRouter();
const items = ref<CompanionResponse[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const showCreate = ref(false);
const draft = reactive({
  name: '',
  identityPrompt: '',
  modelFallbackGroupId: null as string | null,
  promptPresetId: null as string | null,
  personaId: null as string | null
});
const avatarFile = ref<File | null>(null);
const avatarName = ref('');
const modelOptions = ref<SelectOption[]>([]);
const presetOptions = ref<SelectOption[]>([]);
const personaOptions = ref<SelectOption[]>([]);
const importInputRef = ref<HTMLInputElement | null>(null);
const importLoading = ref(false);
const templateLoading = ref(false);
const importPreview = ref<CompanionImportPreview | null>(null);
const importRawJson = ref('');
const importFileName = ref('');
onMounted(load);
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
      avatarAssetId: asset?.id ?? null,
      modelFallbackGroupId: draft.modelFallbackGroupId,
      promptPresetId: draft.promptPresetId,
      personaId: draft.personaId
    });
    await router.push(`/companion/${item.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败';
  } finally {
    saving.value = false;
  }
}
function open(id: string) {
  void router.push(`/companion/${id}`);
}
function openImportPicker() {
  importInputRef.value?.click();
}
async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
    error.value = '请选择 JSON 角色文件。';
    return;
  }
  importLoading.value = true;
  error.value = '';
  try {
    importRawJson.value = await file.text();
    importFileName.value = file.name;
    importPreview.value = (await importCompanionJson({ rawJson: importRawJson.value })).preview;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '角色导入预览失败';
  } finally {
    importLoading.value = false;
  }
}
async function confirmImport() {
  if (!importPreview.value || !importRawJson.value) return;
  importLoading.value = true;
  try {
    const result = await importCompanionJson({
      rawJson: importRawJson.value,
      commit: true,
      duplicateNameStrategy: importPreview.value.nameConflict ? 'rename' : 'reject'
    });
    clearImport();
    if (result.companion) await router.push(`/companion/${result.companion.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '角色导入失败';
  } finally {
    importLoading.value = false;
  }
}
function clearImport() {
  importPreview.value = null;
  importRawJson.value = '';
  importFileName.value = '';
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
  cursor: pointer;
}
.companion-card__body {
  display: flex;
  gap: 14px;
}
.companion-card h3 {
  margin: 0 0 6px;
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
.companion-list__file {
  display: none;
}
.companion-import {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.companion-import h3,
.companion-import p {
  margin: 0;
}
.companion-import p {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
