<template>
  <n-alert type="error" :title="title" :bordered="false">
    {{ description }}
  </n-alert>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: '当前页面暂不可用',
    description: '请求处理失败，请稍后重试。'
  }
);
</script>
