<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>世界书</h2>
      <p>后续阶段在这里维护世界书条目、关键词和命中调试。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="世界书占位" description="当前不包含关键词匹配或注入逻辑。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
