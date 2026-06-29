<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>会话</h2>
      <p>后续阶段在这里实现会话列表、创建入口和会话状态。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="会话页占位" description="当前不包含会话 API 调用。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
