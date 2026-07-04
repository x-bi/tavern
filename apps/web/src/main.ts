/**
 * 前端应用入口：创建 Vue 实例、全局注册 Naive UI 组件、挂载 Pinia 与路由。
 *
 * Naive UI 组件在此全局注册后可在模板中直接使用（如 <n-button>），
 * 避免在每个 SFC 里重复 import。
 */
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NConfigProvider,
  NDialogProvider,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NLoadingBarProvider,
  NMenu,
  NMessageProvider,
  NNotificationProvider,
  NResult,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui';

import App from './App.vue';
import { router } from './router';
import './styles/global.css';

const app = createApp(App);

// 全局注册 Naive UI 组件：注册后模板中可用对应标签（如 <n-button>）
app.component('NAlert', NAlert);
app.component('NAvatar', NAvatar);
app.component('NButton', NButton);
app.component('NCard', NCard);
app.component('NCheckbox', NCheckbox);
app.component('NConfigProvider', NConfigProvider);
app.component('NDialogProvider', NDialogProvider);
app.component('NDrawer', NDrawer);
app.component('NDrawerContent', NDrawerContent);
app.component('NForm', NForm);
app.component('NFormItem', NFormItem);
app.component('NInput', NInput);
app.component('NInputNumber', NInputNumber);
app.component('NLayout', NLayout);
app.component('NLayoutContent', NLayoutContent);
app.component('NLayoutHeader', NLayoutHeader);
app.component('NLayoutSider', NLayoutSider);
app.component('NLoadingBarProvider', NLoadingBarProvider);
app.component('NMenu', NMenu);
app.component('NMessageProvider', NMessageProvider);
app.component('NNotificationProvider', NNotificationProvider);
app.component('NResult', NResult);
app.component('NSpace', NSpace);
app.component('NSpin', NSpin);
app.component('NTag', NTag);

app.use(createPinia());
app.use(router);

app.mount('#app');
