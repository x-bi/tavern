<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>设置</h2>
      <p>后续阶段在这里承载本地偏好、运行状态和基础配置。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="设置页占位" description="当前不读写本地配置。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
