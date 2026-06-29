<template>
  <main class="not-found">
    <n-result status="404" title="页面不存在" description="请从左侧导航进入已有占位页面。">
      <template #footer>
        <n-button type="primary" @click="router.push('/characters')">返回角色页</n-button>
      </template>
    </n-result>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<style scoped>
.not-found {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: var(--surface-base);
}
</style>
