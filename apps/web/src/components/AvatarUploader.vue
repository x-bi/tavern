<template>
  <div class="avatar-uploader">
    <n-avatar
      v-if="src"
      class="avatar-uploader__preview"
      round
      :size="72"
      :src="src"
    />
    <n-avatar v-else class="avatar-uploader__preview" round :size="72">
      {{ fallbackText }}
    </n-avatar>

    <div class="avatar-uploader__body">
      <div class="avatar-uploader__actions">
        <n-button secondary :loading="uploading" :disabled="disabled" @click="openFilePicker">
          上传头像
        </n-button>
        <n-button v-if="assetId || src" text :disabled="disabled || uploading" @click="clearAvatar">
          移除
        </n-button>
      </div>

      <p>支持 jpeg、png、webp、gif，最大 2MB。</p>
      <n-alert v-if="localError || error" type="error" :bordered="false">
        {{ localError || error }}
      </n-alert>
    </div>

    <input
      ref="inputRef"
      class="avatar-uploader__input"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      :disabled="disabled || uploading"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { uploadAsset, type Asset } from '../api/assets';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const props = withDefaults(
  defineProps<{
    assetId?: string | null;
    src?: string | null;
    fallback?: string;
    disabled?: boolean;
    error?: string | null;
  }>(),
  {
    assetId: null,
    src: null,
    fallback: 'TL',
    disabled: false,
    error: null
  }
);

const emit = defineEmits<{
  uploaded: [asset: Asset];
  clear: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const localError = ref<string | null>(null);
const fallbackText = computed(() => props.fallback.trim().slice(0, 2).toUpperCase() || 'TL');

function openFilePicker() {
  localError.value = null;
  inputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  target.value = '';
  localError.value = null;

  if (!file) {
    return;
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    localError.value = '只支持 jpeg、png、webp、gif 图片。';
    return;
  }

  if (file.size > MAX_SIZE_BYTES) {
    localError.value = '头像不能超过 2MB。';
    return;
  }

  uploading.value = true;

  try {
    emit('uploaded', await uploadAsset(file));
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '头像上传失败。';
  } finally {
    uploading.value = false;
  }
}

function clearAvatar() {
  localError.value = null;
  emit('clear');
}
</script>

<style scoped>
.avatar-uploader {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.avatar-uploader__preview {
  background: #3d5a80;
  color: #f3f6fb;
  font-weight: 700;
}

.avatar-uploader__body {
  display: grid;
  gap: 8px;
}

.avatar-uploader__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.avatar-uploader__body p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.avatar-uploader__input {
  display: none;
}

@media (max-width: 560px) {
  .avatar-uploader {
    grid-template-columns: 1fr;
  }
}
</style>
