<template>
  <div class="loading-state">
    <n-spin size="medium" />
    <span>{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string;
  }>(),
  {
    text: '加载中'
  }
);
</script>

<style scoped>
.loading-state {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
}
</style>
