<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>备份导入导出</h2>
      <p>后续阶段在这里承载本地数据导出、恢复导入与备份状态。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="备份功能占位" description="阶段 2 只建立页面入口，不读写本地数据。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
