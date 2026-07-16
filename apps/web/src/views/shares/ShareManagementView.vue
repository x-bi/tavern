<template>
  <section class="share-management">
    <header class="page-actions">
      <div>
        <h2>分享管理</h2>
        <p v-if="isAdmin">查看所有成员的分享链接；管理员可撤销任意链接。</p>
        <p v-else>集中查看和管理你创建的全部外部分享链接。</p>
      </div>
      <n-button :loading="loading" secondary @click="load">刷新</n-button>
    </header>

    <n-card :bordered="false">
      <div class="filters">
        <n-input v-model:value="keyword" clearable placeholder="搜索会话、角色或成员" />
        <n-select v-model:value="targetFilter" :options="targetOptions" />
        <n-select v-model:value="statusFilter" :options="statusOptions" />
      </div>
    </n-card>

    <n-spin :show="loading">
      <n-empty v-if="!filteredLinks.length" description="暂无符合条件的分享链接" />
      <div v-else class="share-list">
        <n-card v-for="link in filteredLinks" :key="link.id" size="small" :bordered="false">
          <div class="share-row">
            <div class="share-row__summary">
              <div class="share-row__title">
                <strong>{{ link.targetTitle || targetLabel(link.targetType) }}</strong>
                <n-tag size="small" :type="statusType(link)">{{ statusLabel(link) }}</n-tag>
                <n-tag size="small" :bordered="false">{{ permissionLabel(link.permission) }}</n-tag>
              </div>
              <div class="share-row__meta">
                <span>{{ targetLabel(link.targetType) }}</span>
                <span v-if="link.owner"
                  >成员：{{ link.owner.displayName }}（{{ link.owner.username }}）</span
                >
                <span>创建：{{ formatTime(link.createdAt) }}</span>
                <span>过期：{{ link.expiresAt ? formatTime(link.expiresAt) : '永不过期' }}</span>
                <span
                  >最近访问：{{ link.lastAccessAt ? formatTime(link.lastAccessAt) : '暂无' }}</span
                >
              </div>
            </div>

            <n-input :value="link.shareUrl ?? ''" readonly aria-label="分享链接" />

            <div class="share-row__actions">
              <n-button size="small" :disabled="!isActive(link)" @click="copy(link)">复制</n-button>
              <n-select
                v-if="canEdit(link)"
                :value="link.permission"
                size="small"
                class="permission-select"
                :disabled="!isActive(link)"
                :options="permissionOptions"
                @update:value="changePermission(link, $event)"
              />
              <n-button
                v-if="canEdit(link)"
                size="small"
                :disabled="!isActive(link)"
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
            </div>
          </div>
        </n-card>
      </div>
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import type { ShareLinkItem, SharePermission, ShareTargetType } from '@tavern/shared';
import { computed, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import { getStoredCurrentUser } from '../../api/auth';
import { listShares, regenerateShare, revokeShare, updateShare } from '../../api/shares';

type EffectiveStatus = 'active' | 'expired' | 'revoked';
type StatusFilter = 'all' | EffectiveStatus;

const currentUser = getStoredCurrentUser();
const isAdmin = currentUser?.role === 'admin';
const links = ref<ShareLinkItem[]>([]);
const loading = ref(false);
const keyword = ref('');
const targetFilter = ref<'all' | ShareTargetType>('all');
const statusFilter = ref<StatusFilter>('all');
const message = useMessage();
const dialog = useDialog();

const targetOptions = [
  { label: '全部类型', value: 'all' },
  { label: '酒馆会话', value: 'conversation' },
  { label: 'AI 角色', value: 'companion' }
];
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '有效', value: 'active' },
  { label: '已过期', value: 'expired' },
  { label: '已撤销', value: 'revoked' }
];
const permissionOptions = [
  { label: '可聊天', value: 'chat' },
  { label: '只读', value: 'readonly' }
];

const filteredLinks = computed(() => {
  const query = keyword.value.trim().toLowerCase();

  return links.value.filter((link) => {
    if (targetFilter.value !== 'all' && link.targetType !== targetFilter.value) return false;
    if (statusFilter.value !== 'all' && effectiveStatus(link) !== statusFilter.value) return false;
    if (!query) return true;
    const haystack = [
      link.targetTitle,
      link.owner?.displayName,
      link.owner?.username,
      link.targetId
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
});

async function load() {
  loading.value = true;
  try {
    links.value = (await listShares()).items;
  } catch (error) {
    message.error(messageOf(error));
  } finally {
    loading.value = false;
  }
}

function canEdit(link: ShareLinkItem) {
  return link.ownerUserId === currentUser?.id;
}

function isActive(link: ShareLinkItem) {
  return effectiveStatus(link) === 'active';
}

function effectiveStatus(link: ShareLinkItem): EffectiveStatus {
  if (link.status === 'revoked') return 'revoked';
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

function statusLabel(link: ShareLinkItem) {
  return { active: '有效', expired: '已过期', revoked: '已撤销' }[effectiveStatus(link)];
}

function statusType(link: ShareLinkItem): 'success' | 'warning' | 'default' {
  return effectiveStatus(link) === 'active'
    ? 'success'
    : effectiveStatus(link) === 'expired'
      ? 'warning'
      : 'default';
}

function targetLabel(type: ShareTargetType) {
  return type === 'conversation' ? '酒馆会话' : 'AI 角色';
}

function permissionLabel(permission: SharePermission) {
  return permission === 'chat' ? '可聊天' : '只读';
}

async function copy(link: ShareLinkItem) {
  if (!link.shareUrl) return;
  try {
    await navigator.clipboard.writeText(link.shareUrl);
    message.success('分享链接已复制');
  } catch {
    message.warning('浏览器禁止自动复制，请手动复制。');
  }
}

async function changePermission(link: ShareLinkItem, permission: SharePermission) {
  try {
    await updateShare(link.id, { permission });
    await load();
    message.success('分享权限已更新');
  } catch (error) {
    message.error(messageOf(error));
  }
}

function regenerate(link: ShareLinkItem) {
  dialog.warning({
    title: '重新生成链接',
    content: '旧链接会立即失效，并创建一条新链接。',
    positiveText: '继续',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const created = await regenerateShare(link.id);
        await load();
        await copy(created);
      } catch (error) {
        message.error(messageOf(error));
      }
    }
  });
}

function revoke(link: ShareLinkItem) {
  dialog.warning({
    title: '撤销分享',
    content:
      isAdmin && !canEdit(link)
        ? `确定撤销成员“${link.owner?.displayName ?? link.owner?.username ?? '未知成员'}”的分享吗？`
        : '撤销后外部页面会立即失效，原聊天不受影响。',
    positiveText: '撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await revokeShare(link.id);
        await load();
        message.success('分享已撤销');
      } catch (error) {
        message.error(messageOf(error));
      }
    }
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : '分享操作失败';
}

onMounted(load);
</script>

<style scoped>
.share-management,
.share-list {
  display: grid;
  gap: 16px;
}

.page-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-actions h2,
.page-actions p {
  margin: 0;
}

.page-actions p {
  margin-top: 6px;
  color: var(--text-muted);
}

.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 160px 140px;
  gap: 12px;
}

.share-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(260px, 0.8fr) auto;
  align-items: center;
  gap: 16px;
}

.share-row__summary {
  min-width: 0;
}

.share-row__title,
.share-row__actions,
.share-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-row__title strong {
  overflow: hidden;
  color: var(--text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-row__meta {
  flex-wrap: wrap;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.permission-select {
  width: 104px;
}

@media (max-width: 1100px) {
  .share-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .page-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .share-row__actions {
    flex-wrap: wrap;
  }
}
</style>
