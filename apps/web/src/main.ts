import { createPinia } from 'pinia';
import { createApp } from 'vue';
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NConfigProvider,
  NDialogProvider,
  NForm,
  NFormItem,
  NInput,
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

app.component('NAlert', NAlert);
app.component('NAvatar', NAvatar);
app.component('NButton', NButton);
app.component('NCard', NCard);
app.component('NConfigProvider', NConfigProvider);
app.component('NDialogProvider', NDialogProvider);
app.component('NForm', NForm);
app.component('NFormItem', NFormItem);
app.component('NInput', NInput);
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
