<template>
  <main class="login-view">
    <section class="login-panel">
      <h1>Tavern Lite</h1>
      <p>登录入口占位。后续阶段接入单用户模式或简单登录。</p>
      <n-button type="primary" @click="router.push('/characters')">进入占位首页</n-button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<style scoped>
.login-view {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: var(--surface-base);
}

.login-panel {
  display: grid;
  gap: 16px;
  width: min(420px, 100%);
  padding: 28px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: var(--surface-panel);
}

.login-panel h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 28px;
}

.login-panel p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}
</style>
