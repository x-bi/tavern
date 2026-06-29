<template>
  <n-layout class="app-layout" has-sider>
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed="appStore.sidebarCollapsed"
      :collapsed-width="64"
      :width="240"
      show-trigger
      @collapse="appStore.setSidebarCollapsed(true)"
      @expand="appStore.setSidebarCollapsed(false)"
    >
      <div class="brand" :class="{ 'brand--collapsed': appStore.sidebarCollapsed }">
        <div class="brand__mark">TL</div>
        <div v-if="!appStore.sidebarCollapsed" class="brand__text">
          <strong>Tavern Lite</strong>
          <span>Web MVP</span>
        </div>
      </div>

      <n-menu
        :collapsed="appStore.sidebarCollapsed"
        :collapsed-width="64"
        :collapsed-icon-size="20"
        :options="menuOptions"
        :value="activeMenuKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="app-header">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>本地角色、会话和模型配置工作台</p>
        </div>
        <n-tag size="small" :bordered="false" type="info">本地模式</n-tag>
      </n-layout-header>

      <n-layout-content class="app-content">
        <RouterView />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import type { MenuOption } from 'naive-ui';
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';

import { usePageTitle } from '../composables/usePageTitle';
import { useAppStore } from '../stores/app';
import { navigationItems } from '../types/navigation';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const pageTitle = usePageTitle();

const menuOptions = computed<MenuOption[]>(() =>
  navigationItems.map((item) => ({
    key: item.path,
    label: item.label
  }))
);

const activeMenuKey = computed(() => {
  const currentPath = route.path;
  const activeItem = navigationItems.find((item) => currentPath.startsWith(item.path));

  return activeItem?.path ?? currentPath;
});

function handleMenuSelect(path: string) {
  if (path !== route.path) {
    router.push(path);
  }
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 72px;
  padding: 0 18px;
}

.brand--collapsed {
  justify-content: center;
  padding: 0;
}

.brand__mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: #2b3a55;
  color: #f3f6fb;
  font-weight: 700;
}

.brand__text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.brand__text strong {
  color: var(--text-strong);
  font-size: 15px;
}

.brand__text span {
  color: var(--text-muted);
  font-size: 12px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: 0 24px;
}

.app-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
}

.app-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.app-content {
  min-height: calc(100vh - 72px);
  padding: 24px;
  background: var(--surface-base);
}
</style>
