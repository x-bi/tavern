<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <div>
        <h2>图片管理</h2>
        <p>管理员只查看图片、模型、安全参数、Hash 与脱敏来源，不读取成员完整 Prompt 或聊天原文。</p>
      </div>
      <n-button secondary :loading="loading" @click="load">刷新</n-button>
    </header>
    <n-card :bordered="false">
      <n-space>
        <n-input v-model:value="filters.userId" placeholder="用户 ID" clearable />
        <n-input v-model:value="filters.modelId" placeholder="模型 ID" clearable />
        <n-select
          v-model:value="filters.status"
          :options="statusOptions"
          placeholder="状态"
          clearable
          class="admin-image__select"
        />
        <n-button type="primary" :loading="loading" @click="load">筛选</n-button>
      </n-space>
    </n-card>
    <LoadingState v-if="loading" text="正在加载全站图片" />
    <EmptyState
      v-else-if="!items.length"
      title="暂无图片"
      description="尚无成员生成聊天场景图片。"
    />
    <n-data-table
      v-else
      :columns="columns"
      :data="items"
      :row-key="(row: AdminImageListItem) => row.id"
    />
    <n-modal
      v-model:show="visible"
      preset="card"
      title="管理员脱敏详情"
      class="admin-image__detail"
    >
      <template v-if="detail">
        <AuthenticatedImage :src="detail.fileUrl" />
        <pre>{{ JSON.stringify(detail, null, 2) }}</pre>
      </template>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import type { AdminImageDetailResponse, AdminImageListItem } from '@tavern/shared';
import type { DataTableColumns } from 'naive-ui';
import { h, onMounted, ref } from 'vue';
import { NButton, useMessage } from 'naive-ui';

import { fetchAdminImageDetail, fetchAdminImages } from '../../api/images';
import AuthenticatedImage from '../../components/AuthenticatedImage.vue';
import EmptyState from '../../components/EmptyState.vue';
import LoadingState from '../../components/LoadingState.vue';

const items = ref<AdminImageListItem[]>([]);
const detail = ref<AdminImageDetailResponse | null>(null);
const loading = ref(false);
const visible = ref(false);
const filters = ref({ userId: '', modelId: '', status: null as string | null });
const statusOptions = [
  { label: '有效', value: 'active' },
  { label: '已删除', value: 'deleted' }
];
const message = useMessage();
const columns: DataTableColumns<AdminImageListItem> = [
  { title: '成员', key: 'username', ellipsis: { tooltip: true } },
  { title: '图片 ID', key: 'id', ellipsis: { tooltip: true } },
  { title: '模型', key: 'modelName', ellipsis: { tooltip: true } },
  { title: '风格', key: 'stylePreset' },
  { title: '比例', key: 'aspectRatio' },
  { title: '状态', key: 'status' },
  { title: '创建时间', key: 'createdAt' },
  {
    title: '操作',
    key: 'actions',
    render: (row) =>
      h(
        NButton,
        { size: 'small', secondary: true, onClick: () => showDetail(row.id) },
        {
          default: () => '脱敏详情'
        }
      )
  }
];

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (filters.value.userId) query.set('userId', filters.value.userId);
    if (filters.value.modelId) query.set('modelId', filters.value.modelId);
    if (filters.value.status) query.set('status', filters.value.status);
    items.value = (await fetchAdminImages(`?${query.toString()}`)).items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '图片加载失败。');
  } finally {
    loading.value = false;
  }
}

async function showDetail(id: string) {
  detail.value = await fetchAdminImageDetail(id);
  visible.value = true;
}
</script>

<style scoped>
.admin-image__detail {
  width: min(900px, 94vw);
}

.admin-image__select {
  width: 160px;
}

.admin-image__detail :deep(.n-image),
.admin-image__detail :deep(img) {
  max-width: 100%;
  max-height: 480px;
}

pre {
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
