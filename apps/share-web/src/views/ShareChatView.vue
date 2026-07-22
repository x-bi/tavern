<template>
  <main class="share-page">
    <section v-if="loading" class="state-page"><p>正在验证分享链接…</p></section>
    <section v-else-if="error" class="state-page">
      <div>
        <span class="eyebrow">TAVERN SHARE</span>
        <h1>链接不可用</h1>
        <p>{{ error }}</p>
        <button class="secondary" @click="load">重新检查</button>
      </div>
    </section>
    <template v-else-if="bootstrap">
      <header class="share-header">
        <div class="identity">
          <img v-if="bootstrap.avatarUrl" :src="bootstrap.avatarUrl" alt="" />
          <div class="avatar" v-else>{{ bootstrap.participantName.slice(0, 1) }}</div>
          <div>
            <span class="eyebrow">共享聊天</span>
            <h1>{{ bootstrap.title }}</h1>
            <p>
              {{ bootstrap.participantName }} ·
              {{ bootstrap.permission === 'readonly' ? '只读' : '可聊天' }}
            </p>
          </div>
        </div>
        <span class="live" :class="{ offline: !connected }">{{
          connected ? '已同步' : '重连中'
        }}</span>
      </header>
      <section ref="messageList" class="messages">
        <p v-if="!messages.length" class="empty">还没有消息。</p>
        <article
          v-for="message in messages"
          :key="message.messageId"
          class="message"
          :class="`message--${message.role}`"
        >
          <div class="message__meta">
            <strong>{{ message.role === 'assistant' ? bootstrap.participantName : '访客' }}</strong
            ><span>{{ formatTime(message.createdAt) }}</span
            ><span v-if="message.status !== 'complete'">{{ statusLabel(message.status) }}</span>
          </div>
          <div class="message__content">
            {{ message.content || (message.status === 'generating' ? '正在输入…' : '') }}
          </div>
          <button
            v-if="
              bootstrap.permission === 'chat' &&
              message.role === 'assistant' &&
              isLatest(message.messageId) &&
              !streaming
            "
            class="text-button"
            @click="regenerate(message)"
          >
            重新生成
          </button>
        </article>
      </section>
      <footer v-if="bootstrap.permission === 'chat'" class="composer">
        <textarea
          v-model="draft"
          :disabled="streaming"
          rows="3"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          @keydown="keydown"
        />
        <div class="composer__actions">
          <span>{{ streamError }}</span
          ><button v-if="streaming" class="danger" @click="stop">停止</button
          ><button v-else :disabled="!draft.trim()" @click="send">发送</button>
        </div>
      </footer>
      <footer v-else class="readonly">此链接为只读模式。消息会自动同步。</footer>
    </template>
  </main>
</template>

<script setup lang="ts">
import {
  createGenerationRequestId,
  type PublicShareBootstrap,
  type PublicShareMessage
} from '@tavern/shared';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const token = String(route.params.token);
const base = `/api/public/shares/${encodeURIComponent(token)}`;
const bootstrap = ref<PublicShareBootstrap | null>(null);
const messages = ref<PublicShareMessage[]>([]);
const loading = ref(true);
const error = ref('');
const draft = ref('');
const streaming = ref(false);
const streamError = ref('');
const connected = ref(false);
const messageList = ref<HTMLElement | null>(null);
let events: EventSource | null = null;
let streamAbort: AbortController | null = null;
let reloadTimer: number | null = null;
let localMessageSeed = 0;
let optimisticAssistantId: string | null = null;
onMounted(load);
onBeforeUnmount(() => {
  events?.close();
  streamAbort?.abort();
  if (reloadTimer) clearTimeout(reloadTimer);
});
async function raw<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) {
    let message = '分享链接无效、已撤销或已过期。';
    try {
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    bootstrap.value = await raw<PublicShareBootstrap>('/bootstrap');
    await reloadMessages();
    connectEvents();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '分享链接不可用。';
  } finally {
    loading.value = false;
  }
}
async function reloadMessages() {
  messages.value = await raw<PublicShareMessage[]>('/messages');
  optimisticAssistantId = null;
  await scrollToBottom();
}
function connectEvents() {
  events?.close();
  events = new EventSource(`${base}/events`);
  events.onopen = () => {
    connected.value = true;
  };
  events.onerror = () => {
    connected.value = false;
  };
  for (const name of [
    'message_created',
    'message_updated',
    'message_deleted',
    'generation_started',
    'generation_done',
    'generation_failed'
  ])
    events.addEventListener(name, scheduleReload);
  events.addEventListener('delta', (event) => {
    if (streaming.value) return;
    const data = JSON.parse((event as MessageEvent).data) as { messageId: string; text: string };
    const message = messages.value.find((item) => item.messageId === data.messageId);
    if (message) message.content += data.text;
    else scheduleReload();
  });
  events.addEventListener('share_revoked', () => {
    events?.close();
    bootstrap.value = null;
    error.value = '此分享链接已被撤销或已过期。';
  });
}
function scheduleReload() {
  if (streaming.value) return;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = window.setTimeout(() => void reloadMessages(), 80);
}
async function send() {
  const text = draft.value.trim();
  if (!text || streaming.value) return;
  draft.value = '';
  appendOptimisticTurn(text);
  await runStream('/chat/stream', { requestId: createGenerationRequestId(), userMessage: text });
}
async function regenerate(message: PublicShareMessage) {
  if (!message.turnId) {
    streamError.value = '该历史消息没有逻辑轮次，无法重新生成。';
    return;
  }
  appendOptimisticAssistant(message.messageId);
  await runStream(`/messages/${encodeURIComponent(message.messageId)}/regenerate`, {
    requestId: createGenerationRequestId(),
    turnId: message.turnId
  });
}
async function runStream(path: string, body?: unknown) {
  streaming.value = true;
  streamError.value = '';
  const abort = new AbortController();
  streamAbort = abort;
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal
    });
    if (!response.ok || !response.body)
      throw new Error(
        response.status === 403 ? '此链接为只读模式。' : `发送失败 (${response.status})`
      );
    await consumeStream(response.body);
  } catch (e) {
    if (!abort.signal.aborted) streamError.value = e instanceof Error ? e.message : '发送失败';
  } finally {
    streaming.value = false;
    streamAbort = null;
    await reloadMessages().catch(() => undefined);
  }
}
async function consumeStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const rawFrame of frames) {
      const event = rawFrame.match(/^event:\s*(.+)$/m)?.[1];
      const dataText = rawFrame.match(/^data:\s*(.+)$/m)?.[1];
      if (!dataText) continue;
      const data = JSON.parse(dataText) as { messageId?: string; text?: string; message?: string };
      if (event === 'delta' && data.messageId && data.text) {
        let message = messages.value.find((item) => item.messageId === data.messageId);
        if (!message && optimisticAssistantId) {
          message = messages.value.find((item) => item.messageId === optimisticAssistantId);
          if (message) message.messageId = data.messageId;
          optimisticAssistantId = null;
        }
        if (!message) {
          message = {
            messageId: data.messageId,
            turnId: null,
            role: 'assistant',
            content: '',
            status: 'generating',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          messages.value.push(message);
        }
        if (!message) continue;
        message.content += data.text;
        void scrollToBottom();
      }
      if (event === 'done' && data.messageId) completeOptimisticAssistant(data.messageId);
      if (event === 'error') throw new Error(data.message ?? '生成失败');
    }
  }
}
function appendOptimisticTurn(content: string) {
  messages.value.push(createLocalMessage('user', content, 'complete'));
  appendOptimisticAssistant();
}
function appendOptimisticAssistant(replaceMessageId?: string) {
  const message = createLocalMessage('assistant', '', 'generating');
  optimisticAssistantId = message.messageId;
  const replaceIndex = replaceMessageId
    ? messages.value.findIndex((item) => item.messageId === replaceMessageId)
    : -1;
  if (replaceIndex >= 0) messages.value.splice(replaceIndex, 1, message);
  else messages.value.push(message);
  void scrollToBottom();
}
function createLocalMessage(
  role: 'user' | 'assistant',
  content: string,
  status: 'complete' | 'generating'
): PublicShareMessage {
  const now = new Date().toISOString();
  localMessageSeed += 1;
  return {
    messageId: `local-${now}-${localMessageSeed}`,
    turnId: null,
    role,
    content,
    status,
    createdAt: now,
    updatedAt: now
  };
}
function completeOptimisticAssistant(messageId: string) {
  const message = messages.value.find(
    (item) => item.messageId === messageId || item.messageId === optimisticAssistantId
  );
  if (message) {
    message.messageId = messageId;
    message.status = 'complete';
    message.updatedAt = new Date().toISOString();
  }
  optimisticAssistantId = null;
}
async function scrollToBottom() {
  await nextTick();
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
}
async function stop() {
  streamAbort?.abort();
  await fetch(`${base}/chat/stop`, { method: 'POST' }).catch(() => undefined);
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
}
function isLatest(id: string) {
  return messages.value.at(-1)?.messageId === id;
}
function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function statusLabel(status: string) {
  switch (status) {
    case 'generating':
      return '生成中';
    case 'failed':
      return '失败';
    case 'stopped':
      return '已停止';
    case 'edited':
      return '已编辑';
    case 'deleted':
      return '已删除';
    default:
      return status;
  }
}
</script>
