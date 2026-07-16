<template>
  <div class="share-manager">
    <n-button secondary @click="open">分享</n-button>
    <n-drawer
      v-model:show="visible"
      width="min(560px, 100vw)"
      placement="right"
      :mask-closable="!busy"
    >
      <n-drawer-content title="外部分享" closable>
        <n-alert type="warning" :bordered="false"
          >访客将读取同一聊天线程；聊天权限下发送的消息会直接写入原线程。</n-alert
        >
        <div class="share-create">
          <n-select v-model:value="permission" :options="permissionOptions" />
          <n-date-picker
            v-model:value="expiresAt"
            type="datetime"
            clearable
            placeholder="永不过期"
          />
          <n-button type="primary" :loading="busy" @click="create">生成链接</n-button>
        </div>
        <n-spin :show="loading">
          <n-empty v-if="!links.length" description="当前会话暂无分享链接" />
          <div v-else class="share-list">
            <section v-for="link in links" :key="link.id" class="share-item">
              <div class="share-item__meta">
                <n-tag :type="link.status === 'active' ? 'success' : 'default'">{{
                  link.status === 'active' ? '有效' : '已撤销'
                }}</n-tag>
                <n-select
                  :value="link.permission"
                  size="small"
                  :disabled="link.status !== 'active'"
                  :options="permissionOptions"
                  @update:value="changePermission(link, $event)"
                />
                <n-date-picker
                  :value="link.expiresAt ? new Date(link.expiresAt).getTime() : null"
                  type="datetime"
                  size="small"
                  clearable
                  :disabled="link.status !== 'active'"
                  placeholder="永不过期"
                  @update:value="changeExpiry(link, $event)"
                />
                <span>{{
                  link.expiresAt ? `过期：${formatTime(link.expiresAt)}` : '永不过期'
                }}</span>
                <span
                  >最近访问：{{ link.lastAccessAt ? formatTime(link.lastAccessAt) : '暂无' }}</span
                >
              </div>
              <n-input :value="link.shareUrl ?? ''" readonly />
              <n-space>
                <n-button size="small" :disabled="link.status !== 'active'" @click="copy(link)"
                  >复制链接</n-button
                >
                <n-button
                  size="small"
                  :disabled="link.status !== 'active'"
                  @click="regenerate(link)"
                  >重新生成</n-button
                >
                <n-button
                  size="small"
                  type="error"
                  secondary
                  :disabled="link.status !== 'active'"
                  @click="revoke(link)"
                  >撤销</n-button
                >
              </n-space>
            </section>
          </div>
        </n-spin>
        <template #footer>
          <n-space justify="space-between" class="share-footer">
            <n-button type="error" secondary :disabled="!activeLinks.length" @click="revokeAll"
              >撤销当前会话全部链接</n-button
            >
            <n-button @click="visible = false">关闭</n-button>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import type { ShareLinkItem, SharePermission, ShareTargetType } from '@tavern/shared';
import { computed, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import {
  bulkRevokeShares,
  createShare,
  listShares,
  regenerateShare,
  revokeShare,
  updateShare
} from '../api/shares';
const props = defineProps<{ targetType: ShareTargetType; targetId: string }>();
const visible = ref(false);
const loading = ref(false);
const busy = ref(false);
const links = ref<ShareLinkItem[]>([]);
const permission = ref<SharePermission>('chat');
const expiresAt = ref<number | null>(null);
const toast = useMessage();
const dialog = useDialog();
const permissionOptions = [
  { label: '可聊天', value: 'chat' },
  { label: '只读', value: 'readonly' }
];
const activeLinks = computed(() => links.value.filter((item) => item.status === 'active'));
async function open() {
  visible.value = true;
  await load();
}
async function load() {
  loading.value = true;
  try {
    links.value = (await listShares(props.targetType, props.targetId)).items;
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    loading.value = false;
  }
}
async function create() {
  busy.value = true;
  try {
    const link = await createShare({
      targetType: props.targetType,
      targetId: props.targetId,
      permission: permission.value,
      expiresAt: expiresAt.value ? new Date(expiresAt.value).toISOString() : null
    });
    await load();
    await copy(link);
  } catch (e) {
    toast.error(messageOf(e));
  } finally {
    busy.value = false;
  }
}
async function copy(link: ShareLinkItem) {
  if (!link.shareUrl) return;
  try {
    await navigator.clipboard.writeText(link.shareUrl);
    toast.success('分享链接已复制');
  } catch {
    toast.warning('浏览器禁止自动复制，请手动复制。');
  }
}
async function changePermission(link: ShareLinkItem, value: SharePermission) {
  try {
    await updateShare(link.id, { permission: value });
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}
async function changeExpiry(link: ShareLinkItem, value: number | null) {
  try {
    await updateShare(link.id, { expiresAt: value ? new Date(value).toISOString() : null });
    await load();
  } catch (e) {
    toast.error(messageOf(e));
  }
}
function revoke(link: ShareLinkItem) {
  dialog.warning({
    title: '撤销分享',
    content: '撤销后外部页面会立即失效，原聊天不受影响。',
    positiveText: '撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      await revokeShare(link.id);
      await load();
    }
  });
}
function regenerate(link: ShareLinkItem) {
  dialog.warning({
    title: '重新生成链接',
    content: '旧链接会立即撤销，并创建一个新的链接。',
    positiveText: '继续',
    negativeText: '取消',
    onPositiveClick: async () => {
      const created = await regenerateShare(link.id);
      await load();
      await copy(created);
    }
  });
}
function revokeAll() {
  dialog.error({
    title: '撤销全部分享',
    content: '此聊天目标的所有有效外部链接都会失效。',
    positiveText: '全部撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      await bulkRevokeShares(props.targetType, props.targetId);
      await load();
    }
  });
}
function formatTime(value: string) {
  return new Date(value).toLocaleString();
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : '分享操作失败';
}
</script>

<style scoped>
.share-manager {
  display: inline-flex;
}
.share-footer {
  width: 100%;
}
.share-create {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 10px;
  margin: 16px 0;
}
.share-create > .n-button {
  grid-column: 2;
  justify-self: end;
}
.share-list {
  display: grid;
  gap: 12px;
}
.share-item {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
}
.share-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
.share-item__meta .n-select {
  width: 110px;
}
@media (max-width: 640px) {
  .share-create {
    grid-template-columns: 1fr;
  }
  .share-create > .n-button {
    grid-column: 1;
    justify-self: stretch;
  }
}
</style>
