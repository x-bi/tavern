<template>
  <main class="page-shell companion-chat">
    <header class="page-shell__header companion-chat__header">
      <div>
        <h2>{{ companion?.name || 'AI 角色' }}</h2>
        <p>持续关系线程 · {{ memoryLabel }}</p>
      </div>
      <n-space>
        <ShareManager target-type="companion" :target-id="id" />
        <n-button secondary @click="router.push('/companion')">返回 AI 角色</n-button>
      </n-space>
    </header>

    <div class="companion-chat__layout">
      <section class="companion-chat__room">
        <header class="companion-chat__room-header">
          <div>
            <h3>{{ companion?.name || 'AI 角色' }} 的对话</h3>
            <p>{{ memoryLabel }}</p>
          </div>
          <n-button secondary :loading="loading" :disabled="streaming" @click="load"
            >刷新消息</n-button
          >
        </header>

        <section ref="messageList" class="message-list" aria-label="AI 角色消息列表">
          <n-alert v-if="error" class="companion-chat__error" type="error" :bordered="false">
            {{ error }}
          </n-alert>
          <div v-if="loading" class="muted">正在加载...</div>
          <div v-else-if="!messages.length" class="muted">从一句自然的问候开始吧。</div>
          <article
            v-for="message in messages"
            :key="message.id"
            class="bubble"
            :class="`bubble--${message.role}`"
          >
            <header class="bubble__meta">
              <strong>{{ message.role === 'assistant' ? companion?.name : '用户' }}</strong>
              <span>{{ formatTime(message.createdAt) }}</span>
              <n-tag v-if="message.status !== 'complete'" size="small" :bordered="false">{{
                message.status
              }}</n-tag>
            </header>
            <n-input
              v-if="editingMessageId === message.id"
              v-model:value="editDraft"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 8 }"
            />
            <div v-else class="bubble__content">
              {{ message.content || (message.status === 'generating' ? '正在输入…' : '') }}
            </div>
            <footer v-if="message.status !== 'generating'" class="bubble__actions">
              <n-button size="tiny" quaternary @click="copyMessage(message.content)">复制</n-button>
              <template v-if="message.role === 'user'">
                <n-button
                  v-if="editingMessageId !== message.id"
                  size="tiny"
                  quaternary
                  :disabled="streaming"
                  @click="startEdit(message.id, message.content)"
                  >编辑</n-button
                >
                <n-button
                  v-else
                  size="tiny"
                  quaternary
                  type="primary"
                  :loading="editing"
                  @click="saveEdit(message.id)"
                  >保存</n-button
                >
                <n-button
                  v-if="editingMessageId === message.id"
                  size="tiny"
                  quaternary
                  @click="cancelEdit"
                  >取消</n-button
                >
              </template>
              <n-button
                size="tiny"
                quaternary
                type="error"
                :disabled="streaming"
                @click="confirmDelete(message.id)"
                >删除</n-button
              >
              <n-button
                v-if="message.role === 'assistant'"
                size="tiny"
                quaternary
                :disabled="streaming"
                @click="regenerate(message.id)"
                >重新生成</n-button
              >
            </footer>
          </article>
        </section>

        <footer class="composer">
          <n-input
            v-model:value="input"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="输入消息"
            :disabled="streaming"
            @keydown="handleKeydown"
          />
          <div class="composer__markers" aria-label="角色扮演段落标记">
            <n-button
              v-for="marker in roleplayMarkers"
              :key="marker"
              size="tiny"
              secondary
              :disabled="streaming"
              @click="appendRoleplayMarker(marker)"
            >
              {{ marker }}
            </n-button>
          </div>
          <div class="composer__toolbar">
            <n-button size="small" secondary @click="showMemory = true">记忆与设置</n-button>
            <div class="composer__submit-actions">
              <n-button v-if="streaming" type="error" secondary @click="stop">停止</n-button>
              <n-button type="primary" :disabled="!input.trim() || streaming" @click="send"
                >发送</n-button
              >
            </div>
          </div>
        </footer>
      </section>

      <aside class="companion-chat__side" aria-label="AI 角色信息">
        <section class="companion-chat__side-section">
          <h3>角色</h3>
          <p>{{ companion?.name || '加载中' }}</p>
        </section>
        <section class="companion-chat__side-section">
          <h3>长期记忆</h3>
          <p>{{ memoryLabel }}</p>
        </section>
        <section class="companion-chat__side-section">
          <h3>模型</h3>
          <p>{{ modelLabel }}</p>
        </section>
        <section class="companion-chat__side-section">
          <h3>预设</h3>
          <p>{{ presetLabel }}</p>
        </section>
        <section class="companion-chat__side-section">
          <h3>Persona</h3>
          <p>{{ personaLabel }}</p>
        </section>
        <section class="companion-chat__side-section">
          <h3>工具栏</h3>
          <div class="companion-chat__tool-grid">
            <n-button size="small" secondary @click="showMemory = true">记忆与设置</n-button>
          </div>
        </section>
      </aside>
    </div>

    <n-drawer v-model:show="showMemory" placement="right" width="min(520px, 100vw)">
      <n-drawer-content title="记忆与设置" closable>
        <n-spin v-if="loading && !memory" description="正在加载记忆与设置" />
        <n-alert v-else-if="!memory" type="error">
          {{ error || '记忆与设置加载失败，请刷新后重试。' }}
        </n-alert>
        <section v-else class="memory-panel">
          <strong>角色设置</strong>
          <n-form-item label="名字"
            ><n-input v-model:value="settings.name" maxlength="80"
          /></n-form-item>
          <n-form-item label="身份设定"
            ><n-input v-model:value="settings.identityPrompt" type="textarea" :rows="4"
          /></n-form-item>
          <n-form-item label="头像">
            <AvatarUploader
              :asset-id="settings.avatarAssetId"
              :src="settings.avatarUrl"
              :fallback="settings.name"
              :disabled="savingSettings"
              @uploaded="handleAvatarUploaded"
              @clear="clearAvatar"
            />
          </n-form-item>
          <n-form-item label="聊天模型链"
            ><NSelect
              v-model:value="settings.modelFallbackGroupId"
              clearable
              :options="modelOptions"
              placeholder="使用默认模型链"
          /></n-form-item>
          <n-form-item label="Prompt 预设"
            ><NSelect v-model:value="settings.promptPresetId" clearable :options="presetOptions"
          /></n-form-item>
          <n-form-item label="Persona"
            ><NSelect v-model:value="settings.personaId" clearable :options="personaOptions"
          /></n-form-item>
          <div class="memory-switches">
            <n-checkbox v-model:checked="settings.isSensitive">敏感内容</n-checkbox>
            <n-checkbox v-if="isAdmin" v-model:checked="settings.isShared">
              发布到成员内容库
            </n-checkbox>
          </div>
          <n-button :loading="savingSettings" @click="saveSettings">保存角色设置</n-button>
          <strong>长期记忆</strong>
          <div class="memory-switches">
            <n-checkbox v-model:checked="memory.isEnabled">开启长期记忆</n-checkbox
            ><n-checkbox v-model:checked="memory.isPaused" :disabled="!memory.isEnabled"
              >暂停更新</n-checkbox
            ><n-tag
              :type="
                memory.status === 'stale'
                  ? 'warning'
                  : memory.status === 'failed'
                    ? 'error'
                    : 'default'
              "
              >{{ memory.status }}</n-tag
            >
          </div>
          <n-form-item label="总结模型链"
            ><NSelect
              v-model:value="memory.memoryModelFallbackGroupId"
              clearable
              :options="modelOptions"
              placeholder="跟随聊天模型链"
          /></n-form-item>
          <n-form-item label="每隔多少条有效消息更新"
            ><n-input-number v-model:value="memory.updateEveryMessages" :min="1" :max="100"
          /></n-form-item>
          <n-form-item label="关系状态"
            ><n-input
              v-model:value="memory.relationshipState"
              type="textarea"
              :rows="3"
              maxlength="600"
          /></n-form-item>
          <n-form-item label="近期主线"
            ><n-input v-model:value="memory.currentArc" type="textarea" :rows="3" maxlength="800"
          /></n-form-item>
          <n-space
            ><n-button type="primary" :loading="savingMemory" @click="saveMemory">保存</n-button
            ><n-button @click="refreshMemory">立即更新</n-button
            ><n-button type="error" secondary @click="clearMemory">清空记忆</n-button></n-space
          >
          <div v-if="memory.revisions.length" class="revision-list">
            <strong>历史版本</strong
            ><n-button
              v-for="revision in memory.revisions"
              :key="revision.id"
              size="small"
              secondary
              @click="restoreMemory(revision.id)"
              >恢复 v{{ revision.version }}</n-button
            >
          </div>
        </section>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>
<script setup lang="ts">
import type {
  ChatStreamDeltaEvent,
  CompanionMemoryResponse,
  CompanionMessageResponse,
  CompanionResponse
} from '@tavern/shared';
import { NSelect, type SelectOption, useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { parseSseFrame } from '../../composables/useChatStream';
import ShareManager from '../../components/ShareManager.vue';
import AvatarUploader from '../../components/AvatarUploader.vue';
import type { Asset } from '../../api/assets';
import { getStoredCurrentUser } from '../../api/auth';
import { useTargetEvents } from '../../composables/useTargetEvents';
import {
  clearCompanionMemory,
  deleteCompanionMessage,
  fetchCompanion,
  fetchCompanionMemory,
  fetchCompanionMessages,
  regenerateCompanionMessage,
  refreshCompanionMemory,
  restoreCompanionMemory,
  startCompanionChat,
  updateCompanion,
  updateCompanionMessage,
  updateCompanionMemory
} from '../../api/companions';
import { fetchModelFallbackGroups } from '../../api/models';
import { fetchPersonas } from '../../api/personas';
import { fetchPromptPresets } from '../../api/presets';
const route = useRoute();
const router = useRouter();
const dialog = useDialog();
const toast = useMessage();
const id = String(route.params.companionId);
const isAdmin = getStoredCurrentUser()?.role === 'admin';
const companion = ref<CompanionResponse | null>(null);
const memory = ref<CompanionMemoryResponse | null>(null);
const messages = ref<CompanionMessageResponse[]>([]);
const input = ref('');
const error = ref('');
const loading = ref(true);
const streaming = ref(false);
const showMemory = ref(route.query.panel === 'memory');
const savingMemory = ref(false);
const savingSettings = ref(false);
const editing = ref(false);
const editingMessageId = ref<string | null>(null);
const editDraft = ref('');
const controller = ref<AbortController | null>(null);
const messageList = ref<HTMLElement | null>(null);
const modelOptions = ref<SelectOption[]>([]);
const presetOptions = ref<SelectOption[]>([]);
const personaOptions = ref<SelectOption[]>([]);
const settings = reactive({
  name: '',
  identityPrompt: '',
  avatarAssetId: null as string | null,
  avatarUrl: '',
  modelFallbackGroupId: null as string | null,
  promptPresetId: null as string | null,
  personaId: null as string | null,
  isSensitive: false,
  isShared: false
});
const roleplayMarkers = ['台词', '我的动作', '对方动作', '旁白'];
const memoryLabel = computed(() =>
  !memory.value?.isEnabled
    ? '长期记忆未开启'
    : memory.value.isPaused
      ? '长期记忆已暂停'
      : `长期记忆 ${memory.value.status}`
);
const modelLabel = computed(() =>
  getOptionLabel(modelOptions.value, settings.modelFallbackGroupId, '使用默认模型链')
);
const presetLabel = computed(() =>
  getOptionLabel(presetOptions.value, settings.promptPresetId, '未设置')
);
const personaLabel = computed(() =>
  getOptionLabel(personaOptions.value, settings.personaId, '未设置')
);
let syncTimer: number | null = null;
const targetEvents = useTargetEvents(() => {
  if (streaming.value) return;
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(async () => {
    messages.value = await fetchCompanionMessages(id);
    await scrollBottom();
  }, 80);
});
onMounted(async () => {
  targetEvents.connect('companion', id);
  await load();
});

function getOptionLabel(options: SelectOption[], value: string | null, fallback: string) {
  if (!value) return fallback;

  const option = options.find((item) => item.value === value);

  return typeof option?.label === 'string' ? option.label : fallback;
}

function appendRoleplayMarker(marker: string) {
  if (streaming.value) return;

  const separator = input.value && !input.value.endsWith('\n') ? '\n' : '';
  input.value += `${separator}[${marker}] `;
}

async function load() {
  loading.value = true;
  try {
    const [loadedCompanion, loadedMessages, loadedMemory, models, presets, personas] =
      await Promise.all([
        fetchCompanion(id),
        fetchCompanionMessages(id),
        fetchCompanionMemory(id),
        fetchModelFallbackGroups({ pageSize: 100, isEnabled: true }),
        fetchPromptPresets({ pageSize: 100 }),
        fetchPersonas({ pageSize: 100 })
      ]);
    companion.value = loadedCompanion;
    messages.value = loadedMessages;
    memory.value = loadedMemory;
    Object.assign(settings, {
      name: loadedCompanion.name,
      identityPrompt: loadedCompanion.identityPrompt,
      avatarAssetId: loadedCompanion.avatarAssetId,
      avatarUrl: loadedCompanion.avatarUrl ?? '',
      modelFallbackGroupId: loadedCompanion.modelFallbackGroupId,
      promptPresetId: loadedCompanion.promptPresetId,
      personaId: loadedCompanion.personaId,
      isSensitive: loadedCompanion.isSensitive,
      isShared: loadedCompanion.isShared
    });
    modelOptions.value = models.items.map((item) => ({ label: item.name, value: item.id }));
    presetOptions.value = presets.items.map((item) => ({ label: item.name, value: item.id }));
    personaOptions.value = personas.items.map((item) => ({ label: item.name, value: item.id }));
    await scrollBottom();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}
async function send() {
  const text = input.value.trim();
  if (!text || streaming.value) return;
  input.value = '';
  const userTemp = `user-${Date.now()}`;
  const assistantTemp = `assistant-${Date.now()}`;
  messages.value.push(
    {
      id: userTemp,
      companionId: id,
      role: 'user',
      content: text,
      status: 'complete',
      tokenCount: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: assistantTemp,
      companionId: id,
      role: 'assistant',
      content: '',
      status: 'generating',
      tokenCount: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
  await scrollBottom();
  await runStream({ userMessage: text }, assistantTemp);
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    void send();
  }
}

async function regenerate(messageId: string) {
  if (streaming.value) return;

  try {
    const request = await regenerateCompanionMessage(messageId);
    const tempId = `assistant-${Date.now()}`;
    messages.value.push({
      id: tempId,
      companionId: id,
      role: 'assistant',
      content: '',
      status: 'generating',
      tokenCount: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await runStream({ regenerateMessageId: request.regenerateMessageId }, tempId);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '重新生成失败');
  }
}

async function runStream(
  payload: { userMessage?: string; regenerateMessageId?: string },
  temporaryAssistantId: string
) {
  streaming.value = true;
  error.value = '';
  const abort = new AbortController();
  controller.value = abort;

  try {
    const response = await startCompanionChat(id, payload, abort.signal);
    if (!response.body) throw new Error('流响应不可读');
    await readStream(response.body, temporaryAssistantId);
    messages.value = await fetchCompanionMessages(id);
    memory.value = await fetchCompanionMemory(id);
  } catch (e) {
    if (!abort.signal.aborted) error.value = e instanceof Error ? e.message : '生成失败';
    messages.value = await fetchCompanionMessages(id);
  } finally {
    streaming.value = false;
    controller.value = null;
    await scrollBottom();
  }
}
async function readStream(stream: ReadableStream<Uint8Array>, tempId: string) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || '';
    for (const raw of parts) {
      const frame = parseSseFrame(raw);
      if (!frame) continue;
      const data = JSON.parse(frame.data) as ChatStreamDeltaEvent & {
        code?: string;
        message?: string;
      };
      if (frame.event === 'delta') {
        const target = messages.value.find((m) => m.id === tempId || m.id === data.messageId);
        if (target) {
          target.id = data.messageId;
          target.content += data.text;
        }
        await scrollBottom();
      }
      if (frame.event === 'error') throw new Error(data.message || '生成失败');
    }
  }
}
function stop() {
  controller.value?.abort();
}

function startEdit(messageId: string, content: string) {
  editingMessageId.value = messageId;
  editDraft.value = content;
}

function cancelEdit() {
  editingMessageId.value = null;
  editDraft.value = '';
}

async function saveEdit(messageId: string) {
  const content = editDraft.value.trim();
  if (!content) return;
  editing.value = true;

  try {
    await updateCompanionMessage(messageId, content);
    messages.value = await fetchCompanionMessages(id);
    memory.value = await fetchCompanionMemory(id);
    cancelEdit();
    toast.success('消息已保存');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '消息保存失败');
  } finally {
    editing.value = false;
  }
}

function confirmDelete(messageId: string) {
  dialog.warning({
    title: '删除消息',
    content: '删除后会从当前关系线程移除；若影响已总结内容，记忆会进入 stale 并重建。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteCompanionMessage(messageId);
        messages.value = await fetchCompanionMessages(id);
        memory.value = await fetchCompanionMemory(id);
        toast.success('消息已删除');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '删除失败');
      }
    }
  });
}

async function copyMessage(content: string) {
  if (!content) return;

  try {
    await navigator.clipboard.writeText(content);
    toast.success('消息已复制');
  } catch {
    toast.warning('浏览器不允许直接复制，请手动选择文本。');
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

async function saveMemory() {
  if (!memory.value) return;
  savingMemory.value = true;
  try {
    memory.value = await updateCompanionMemory(id, {
      isEnabled: memory.value.isEnabled,
      isPaused: memory.value.isPaused,
      memoryModelFallbackGroupId: memory.value.memoryModelFallbackGroupId,
      updateEveryMessages: memory.value.updateEveryMessages,
      relationshipState: memory.value.relationshipState,
      currentArc: memory.value.currentArc
    });
  } finally {
    savingMemory.value = false;
  }
}
async function saveSettings() {
  if (!settings.name.trim()) return;
  savingSettings.value = true;
  try {
    companion.value = await updateCompanion(id, {
      name: settings.name.trim(),
      identityPrompt: settings.identityPrompt,
      avatarAssetId: settings.avatarAssetId,
      modelFallbackGroupId: settings.modelFallbackGroupId,
      promptPresetId: settings.promptPresetId,
      personaId: settings.personaId,
      isSensitive: settings.isSensitive,
      ...(isAdmin ? { isShared: settings.isShared } : {})
    });
    settings.avatarUrl = companion.value.avatarUrl ?? '';
    toast.success('角色设置已保存');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存角色设置失败';
  } finally {
    savingSettings.value = false;
  }
}

function handleAvatarUploaded(asset: Asset) {
  settings.avatarAssetId = asset.id;
  settings.avatarUrl = asset.publicPath ?? '';
}

function clearAvatar() {
  settings.avatarAssetId = null;
  settings.avatarUrl = '';
}
async function refreshMemory() {
  await refreshCompanionMemory(id);
  memory.value = await fetchCompanionMemory(id);
}
async function clearMemory() {
  await clearCompanionMemory(id);
  memory.value = await fetchCompanionMemory(id);
}
async function restoreMemory(revisionId: string) {
  await restoreCompanionMemory(id, revisionId);
  memory.value = await fetchCompanionMemory(id);
}
async function scrollBottom() {
  await nextTick();
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
}
</script>
<style scoped>
.companion-chat {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  height: calc(100vh - 72px - 48px);
  overflow: hidden;
}

.companion-chat__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.companion-chat__header h2,
.companion-chat__header p {
  margin: 0;
}

.companion-chat__header p,
.muted {
  color: var(--text-muted);
  font-size: 13px;
}

.companion-chat__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  min-height: 0;
}

.companion-chat__room {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.companion-chat__room-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line-subtle);
}

.companion-chat__room-header h3,
.companion-chat__room-header p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.companion-chat__room-header h3 {
  color: var(--text-strong);
  font-size: 16px;
}

.companion-chat__room-header p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.companion-chat__error {
  margin: 0;
}

.message-list {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  scrollbar-width: thin;
}

.message-list::-webkit-scrollbar {
  width: 8px;
}

.message-list::-webkit-scrollbar-track {
  background: transparent;
}

.message-list::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
}

.bubble {
  width: min(75%, 760px);
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble--user {
  justify-self: end;
  background: #2857a4;
}

.bubble__meta,
.bubble__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.bubble__meta strong {
  font-size: 13px;
}

.bubble__meta span {
  color: var(--text-muted);
  font-size: 12px;
}

.bubble__content,
.bubble__actions {
  margin-top: 8px;
}

.bubble__content {
  line-height: 1.7;
}

.composer,
.memory-panel {
  display: grid;
  gap: 10px;
}

.composer {
  padding: 12px;
  border-top: 1px solid var(--line-subtle);
  background: rgba(17, 24, 39, 0.88);
}

.composer__markers,
.composer__toolbar,
.composer__submit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.composer__toolbar {
  align-items: center;
  justify-content: space-between;
}

.companion-chat__side {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.companion-chat__side-section {
  display: grid;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.companion-chat__side-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.companion-chat__side-section h3,
.companion-chat__side-section p {
  margin: 0;
}

.companion-chat__side-section h3 {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.companion-chat__side-section p {
  overflow: hidden;
  color: var(--text-strong);
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.companion-chat__tool-grid {
  display: grid;
}

.memory-panel {
  padding: 4px;
}

.memory-switches,
.revision-list {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 1020px) {
  .companion-chat {
    height: auto;
    overflow: visible;
  }

  .companion-chat__layout {
    grid-template-columns: 1fr;
  }

  .companion-chat__side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .companion-chat {
    height: calc(100dvh - 68px);
    gap: 8px;
  }

  .companion-chat__header {
    gap: 8px;
  }

  .companion-chat__header p,
  .companion-chat__room-header p,
  .companion-chat__side {
    display: none;
  }

  .companion-chat__header h2 {
    font-size: 18px;
  }

  .companion-chat__room {
    border-radius: 6px;
  }

  .companion-chat__room-header {
    gap: 8px;
    padding: 10px 12px;
  }

  .message-list {
    gap: 12px;
    padding: 12px;
  }

  .bubble {
    width: min(88%, 760px);
  }

  .composer {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }

  .composer__markers {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .composer__markers::-webkit-scrollbar {
    display: none;
  }

  .composer__toolbar,
  .composer__submit-actions {
    width: 100%;
  }

  .composer__submit-actions {
    justify-content: flex-end;
  }
}
</style>
