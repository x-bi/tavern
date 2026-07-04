<template>
  <n-config-provider :theme="darkTheme">
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-message-provider>
          <n-notification-provider>
            <RouterView />
          </n-notification-provider>
        </n-message-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
/**
 * 应用根组件：套上暗色主题与 Naive UI 的全局 Provider（加载条/对话框/消息/通知），
 * 为子路由提供反馈能力上下文。RouterView 渲染当前路由页面。
 */
import { darkTheme } from 'naive-ui';
</script>
