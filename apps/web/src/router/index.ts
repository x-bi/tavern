import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '../layouts/AppLayout.vue';
import BackupView from '../views/BackupView.vue';
import CharacterCreateView from '../views/characters/CharacterCreateView.vue';
import CharacterDetailView from '../views/characters/CharacterDetailView.vue';
import CharacterEditView from '../views/characters/CharacterEditView.vue';
import CharacterListView from '../views/characters/CharacterListView.vue';
import ChatView from '../views/ChatView.vue';
import ConversationsView from '../views/ConversationsView.vue';
import LoginView from '../views/LoginView.vue';
import ModelsView from '../views/ModelsView.vue';
import NotFoundView from '../views/NotFoundView.vue';
import PersonaView from '../views/PersonaView.vue';
import PresetsView from '../views/PresetsView.vue';
import PromptPreviewView from '../views/PromptPreviewView.vue';
import SettingsView from '../views/SettingsView.vue';
import WorldBookView from '../views/WorldBookView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        title: '登录入口'
      }
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: '/characters'
        },
        {
          path: 'characters',
          name: 'characters',
          component: CharacterListView,
          meta: {
            title: '角色'
          }
        },
        {
          path: 'characters/new',
          name: 'character-create',
          component: CharacterCreateView,
          meta: {
            title: '新建角色'
          }
        },
        {
          path: 'characters/:id/edit',
          name: 'character-edit',
          component: CharacterEditView,
          meta: {
            title: '编辑角色'
          }
        },
        {
          path: 'characters/:id',
          name: 'character-detail',
          component: CharacterDetailView,
          meta: {
            title: '角色详情'
          }
        },
        {
          path: 'conversations',
          name: 'conversations',
          component: ConversationsView,
          meta: {
            title: '会话'
          }
        },
        {
          path: 'chat',
          name: 'chat',
          component: ChatView,
          meta: {
            title: '聊天'
          }
        },
        {
          path: 'models',
          name: 'models',
          component: ModelsView,
          meta: {
            title: '模型'
          }
        },
        {
          path: 'presets',
          name: 'presets',
          component: PresetsView,
          meta: {
            title: '预设'
          }
        },
        {
          path: 'persona',
          name: 'persona',
          component: PersonaView,
          meta: {
            title: 'Persona'
          }
        },
        {
          path: 'worldbook',
          name: 'worldbook',
          component: WorldBookView,
          meta: {
            title: '世界书'
          }
        },
        {
          path: 'prompt-preview',
          name: 'prompt-preview',
          component: PromptPreviewView,
          meta: {
            title: 'Prompt 预览'
          }
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: {
            title: '设置'
          }
        },
        {
          path: 'backup',
          name: 'backup',
          component: BackupView,
          meta: {
            title: '备份导入导出'
          }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
      meta: {
        title: '页面不存在'
      }
    }
  ]
});
