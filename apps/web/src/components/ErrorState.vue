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
    description: '这里是错误状态占位，后续阶段接入真实错误处理。'
  }
);
</script>
