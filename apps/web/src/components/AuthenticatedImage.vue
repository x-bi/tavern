<template>
  <n-image
    v-if="objectUrl"
    :src="objectUrl"
    :alt="alt"
    object-fit="cover"
    :preview-disabled="previewDisabled"
  />
  <n-skeleton v-else :height="160" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { authHeaders, toApiUrl } from '../api/http';

const props = withDefaults(
  defineProps<{ src: string; alt?: string; previewDisabled?: boolean }>(),
  { alt: '生成图片' }
);
const objectUrl = ref<string | null>(null);
let controller: AbortController | null = null;

watch(
  () => props.src,
  async (src) => {
    controller?.abort();
    controller = new AbortController();
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
    try {
      const response = await fetch(src.startsWith('/api/') ? src : toApiUrl(src), {
        headers: authHeaders(),
        signal: controller.signal
      });
      if (!response.ok) return;
      objectUrl.value = URL.createObjectURL(await response.blob());
    } catch {
      // 图片错误由空骨架表达，避免泄露受控接口细节。
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  controller?.abort();
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
});
</script>
