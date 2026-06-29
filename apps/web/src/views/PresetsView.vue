<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>预设</h2>
      <p>后续阶段在这里维护参数预设和输出风格入口。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="预设页占位" description="当前不包含参数表单和业务规则。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
