<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>Prompt 预览</h2>
      <p>后续阶段在这里展示后端 Prompt Builder 的真实组成结果。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="Prompt 预览占位" description="当前不在前端拼接或硬编码 Prompt。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
