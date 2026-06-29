<template>
  <div class="empty-state">
    <div class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__description">{{ description }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<style scoped>
.empty-state {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 56px 24px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state__title {
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 600;
}

.empty-state__description {
  max-width: 520px;
  line-height: 1.7;
}
</style>
