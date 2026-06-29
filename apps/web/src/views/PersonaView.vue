<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>Persona</h2>
      <p>后续阶段在这里配置用户 Persona，并供 Prompt Builder 使用。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="Persona 占位" description="当前不包含表单、保存或 Prompt 拼接逻辑。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
