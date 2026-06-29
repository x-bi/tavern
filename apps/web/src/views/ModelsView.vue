<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>模型</h2>
      <p>后续阶段在这里实现模型配置、连接测试和模型参数入口。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="模型配置占位" description="当前不保存 API Key，也不调用模型供应商。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
