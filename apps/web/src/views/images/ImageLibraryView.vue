<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <div>
        <h2>我的图片</h2>
        <p>聊天场景生成的图片独立长期保存；删除消息不会自动删除图片。</p>
      </div>
      <n-button secondary :loading="loading" @click="load">刷新</n-button>
    </header>
    <n-alert type="info" :bordered="false">
      应用级 JSON 备份不包含生图批次、图片文件、Prompt 或消息图片关联。
    </n-alert>
    <n-card :bordered="false">
      <n-space>
        <n-select
          v-model:value="filters.stylePreset"
          :options="styleOptions"
          placeholder="风格"
          clearable
          class="image-library__filter"
        />
        <n-select
          v-model:value="filters.status"
          :options="statusOptions"
          placeholder="状态"
          clearable
          class="image-library__filter"
        />
        <n-input v-model:value="filters.modelId" placeholder="模型 ID" clearable />
        <n-button type="primary" :loading="loading" @click="load">筛选</n-button>
      </n-space>
    </n-card>
    <LoadingState v-if="loading" text="正在加载图片" />
    <EmptyState
      v-else-if="!items.length"
      title="还没有图片"
      description="可在已完成的角色回复下生成当前场景。"
    />
    <div v-else class="image-library__grid">
      <n-card v-for="item in items" :key="item.id" :bordered="false">
        <AuthenticatedImage :src="item.fileUrl" :alt="item.sourceMessageSummary ?? '场景图片'" />
        <dl>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatTime(item.createdAt) }}</dd>
          </div>
          <div>
            <dt>风格 / 比例</dt>
            <dd>{{ item.stylePreset }} / {{ item.aspectRatio }}</dd>
          </div>
          <div>
            <dt>聊天展示</dt>
            <dd>{{ item.isDisplayedInChat ? '是' : '否' }}</dd>
          </div>
        </dl>
        <p>{{ item.sourceMessageSummary ?? '无来源摘要' }}</p>
        <template #action>
          <n-space justify="end">
            <n-button size="small" secondary @click="showDetail(item.id)">详情</n-button>
            <n-button size="small" secondary type="error" @click="remove(item.id)">删除</n-button>
          </n-space>
        </template>
      </n-card>
    </div>
    <n-modal
      v-model:show="detailVisible"
      preset="card"
      title="图片详情"
      class="image-library__detail"
    >
      <template v-if="detail">
        <AuthenticatedImage :src="detail.fileUrl" />
        <n-descriptions label-placement="left" :column="1" bordered>
          <n-descriptions-item label="批次">{{ detail.batchId }}</n-descriptions-item>
          <n-descriptions-item label="模型链">{{
            detail.modelFallbackGroupId
          }}</n-descriptions-item>
          <n-descriptions-item label="实际生图模型">{{
            detail.providerModelId ?? '未知'
          }}</n-descriptions-item>
          <n-descriptions-item label="场景文字模型">{{
            detail.scenePromptModelId ?? '未知'
          }}</n-descriptions-item>
          <n-descriptions-item label="Prompt 版本">{{
            detail.scenePromptVersion
          }}</n-descriptions-item>
          <n-descriptions-item label="Compiler">{{
            detail.promptCompilerVersion
          }}</n-descriptions-item>
          <n-descriptions-item label="来源消息">{{
            detail.sourceMessageId ?? '已解除关联'
          }}</n-descriptions-item>
        </n-descriptions>
        <n-collapse>
          <n-collapse-item title="最终 Prompt">
            <pre>{{ detail.prompt }}</pre>
          </n-collapse-item>
          <n-collapse-item title="负面 Prompt">
            <pre>{{ detail.negativePrompt }}</pre>
          </n-collapse-item>
          <n-collapse-item title="场景快照">
            <pre>{{ JSON.stringify(detail.sceneSnapshot, null, 2) }}</pre>
          </n-collapse-item>
        </n-collapse>
      </template>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import {
  IMAGE_STYLE_PRESETS,
  type ImageDetailResponse,
  type ImageListItem
} from '@tavern/shared';
import { onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';

import { deleteImage, fetchImageDetail, fetchImages } from '../../api/images';
import AuthenticatedImage from '../../components/AuthenticatedImage.vue';
import EmptyState from '../../components/EmptyState.vue';
import LoadingState from '../../components/LoadingState.vue';

const loading = ref(false);
const items = ref<ImageListItem[]>([]);
const detail = ref<ImageDetailResponse | null>(null);
const detailVisible = ref(false);
const filters = ref({
  stylePreset: null as string | null,
  status: null as string | null,
  modelId: ''
});
const styleOptions = IMAGE_STYLE_PRESETS.map((value) => ({ label: value, value }));
const statusOptions = [
  { label: '有效', value: 'active' },
  { label: '已删除', value: 'deleted' }
];
const dialog = useDialog();
const message = useMessage();

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (filters.value.stylePreset) query.set('stylePreset', filters.value.stylePreset);
    if (filters.value.status) query.set('status', filters.value.status);
    if (filters.value.modelId) query.set('modelId', filters.value.modelId);
    items.value = (await fetchImages(`?${query.toString()}`)).items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '图片加载失败。');
  } finally {
    loading.value = false;
  }
}

async function showDetail(id: string) {
  detail.value = await fetchImageDetail(id);
  detailVisible.value = true;
}

function remove(id: string) {
  dialog.warning({
    title: '删除图片',
    content: '图片会先软删除，并在清理阈值后回收物理文件。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deleteImage(id);
      await load();
    }
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}
</script>

<style scoped>
.image-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.image-library__filter {
  width: 160px;
}

.image-library__grid :deep(.n-image),
.image-library__grid :deep(img) {
  width: 100%;
  height: 220px;
  border-radius: 8px;
}

dl {
  display: grid;
  gap: 6px;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

dt,
p {
  color: var(--text-muted);
}

dd {
  margin: 0;
}

.image-library__detail {
  width: min(900px, 94vw);
}

pre {
  overflow: auto;
  white-space: pre-wrap;
}
</style>
