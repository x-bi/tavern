<template>
  <section class="message-images">
    <div v-if="generating" class="message-images__generating">
      <n-spin size="small" />
      <span>正在生成当前场景…</span>
    </div>
    <n-image-group v-if="images.length">
      <div class="message-images__grid">
        <AuthenticatedImage
          v-for="image in images"
          :key="image.imageAssetId"
          :src="image.fileUrl"
          :alt="`场景图片 ${image.orderIndex + 1}`"
        />
      </div>
    </n-image-group>
    <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>
    <n-button
      v-if="images.length"
      size="small"
      secondary
      :loading="generating"
      :disabled="!enabled"
      @click="$emit('regenerate')"
    >
      重新生成图片
    </n-button>
    <n-button
      v-else
      size="small"
      secondary
      :loading="generating"
      :disabled="!enabled"
      @click="$emit('generate')"
    >
      生成当前场景
    </n-button>
    <small v-if="!enabled">请先在会话设置中选择可用的聊天模型链和生图模型链。</small>
  </section>
</template>

<script setup lang="ts">
import type { SceneImage } from '@tavern/shared';

import AuthenticatedImage from './AuthenticatedImage.vue';

withDefaults(
  defineProps<{
    images?: SceneImage[];
    generating?: boolean;
    error?: string | null;
    enabled?: boolean;
  }>(),
  { images: () => [], enabled: true }
);

defineEmits<{ generate: []; regenerate: [] }>();
</script>

<style scoped>
.message-images {
  display: grid;
  gap: 8px;
}

.message-images__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.message-images__grid :deep(.n-image),
.message-images__grid :deep(img) {
  width: 100%;
  min-height: 120px;
  max-height: 320px;
  border-radius: 6px;
}

.message-images__generating {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--text-muted);
  font-size: 13px;
}

.message-images small {
  color: var(--text-muted);
}
</style>
