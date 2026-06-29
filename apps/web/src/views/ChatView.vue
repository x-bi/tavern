<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>聊天</h2>
      <p>后续阶段在这里接入会话上下文、消息列表和流式输出。</p>
    </header>
    <n-card class="page-panel" :bordered="false">
      <EmptyState title="聊天页占位" description="当前不包含聊天流、模型调用或消息持久化逻辑。" />
    </n-card>
  </main>
</template>

<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
</script>
