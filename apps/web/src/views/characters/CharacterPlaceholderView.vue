<template>
  <main class="page-shell">
    <header class="page-shell__header">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </header>
    <EmptyState title="功能待接入" description="当前阶段只提供列表入口，表单和详情将在后续阶段补齐。" />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import EmptyState from '../../components/EmptyState.vue';

const route = useRoute();

const title = computed(() => {
  if (route.name === 'character-create') {
    return '新建角色';
  }

  if (route.name === 'character-edit') {
    return '编辑角色';
  }

  return '角色详情';
});

const description = computed(() => {
  if (route.name === 'character-create') {
    return '后续阶段将在这里接入角色创建表单。';
  }

  if (route.name === 'character-edit') {
    return '后续阶段将在这里接入角色编辑表单。';
  }

  return '后续阶段将在这里展示角色完整信息。';
});
</script>
