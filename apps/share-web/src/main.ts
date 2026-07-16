import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import ShareChatView from './views/ShareChatView.vue';
import NotFoundView from './views/NotFoundView.vue';
import './styles.css';
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/s/:token', component: ShareChatView },
    { path: '/:pathMatch(.*)*', component: NotFoundView }
  ]
});
createApp(App).use(router).mount('#app');
