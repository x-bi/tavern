/**
 * 前端路由配置：登录页与主框架两套布局。
 *
 * - `/login` 独立页面（不套 AppLayout）；
 * - `/` 套 AppLayout，子路由为各业务页面；
 * - `/:pathMatch(.*)*` 兜底 404。
 *
 * 每条路由的 meta.title 由 usePageTitle 读取并写入 document.title。
 * 路由只负责页面装配，不写业务请求逻辑。
 */
import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '../layouts/AppLayout.vue';
import AiImportView from '../views/ai-imports/AiImportView.vue';
import BackupView from '../views/BackupView.vue';
import CharacterCreateView from '../views/characters/CharacterCreateView.vue';
import CharacterDetailView from '../views/characters/CharacterDetailView.vue';
import CharacterEditView from '../views/characters/CharacterEditView.vue';
import CharacterListView from '../views/characters/CharacterListView.vue';
import ChatView from '../views/chat/ChatView.vue';
import ConversationView from '../views/conversations/ConversationView.vue';
import ContentPackImportView from '../views/content-packs/ContentPackImportView.vue';
import CompanionListView from '../views/companions/CompanionListView.vue';
import CompanionChatView from '../views/companions/CompanionChatView.vue';
import LoginView from '../views/LoginView.vue';
import ModelConfigView from '../views/models/ModelConfigView.vue';
import NotFoundView from '../views/NotFoundView.vue';
import PersonaView from '../views/personas/PersonaView.vue';
import PresetView from '../views/presets/PresetView.vue';
import PromptPreviewView from '../views/prompts/PromptPreviewView.vue';
import QqBridgeView from '../views/qq/QqBridgeView.vue';
import SettingView from '../views/settings/SettingView.vue';
import ShareManagementView from '../views/shares/ShareManagementView.vue';
import WorldBookView from '../views/world-books/WorldBookView.vue';
import UserManagementView from '../views/admin/UserManagementView.vue';
import AdminImageManagementView from '../views/admin/AdminImageManagementView.vue';
import ImageLibraryView from '../views/images/ImageLibraryView.vue';
import { fetchCurrentUser, getStoredCurrentUser, logout } from '../api/auth';
import { getAccessToken } from '../api/http';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 登录页：独立布局，不套 AppLayout
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
        // 根路径重定向到角色列表
        {
          path: '',
          redirect: '/characters'
        },
        {
          path: 'ai-imports',
          name: 'ai-imports',
          component: AiImportView,
          meta: {
            title: 'AI 智能导入'
          }
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
          path: 'companion',
          name: 'companion-list',
          component: CompanionListView,
          meta: { title: 'AI 角色' }
        },
        {
          path: 'companion/:companionId',
          name: 'companion-chat',
          component: CompanionChatView,
          meta: { title: 'AI 角色聊天' }
        },
        {
          path: 'conversations',
          name: 'conversations',
          component: ConversationView,
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
        // 指定会话的聊天页：:conversationId 由 ChatView 读取
        {
          path: 'chat/:conversationId',
          name: 'chat-conversation',
          component: ChatView,
          meta: {
            title: '聊天'
          }
        },
        {
          path: 'images',
          name: 'images',
          component: ImageLibraryView,
          meta: { title: '我的图片' }
        },
        {
          path: 'models',
          name: 'models',
          component: ModelConfigView,
          meta: {
            title: '模型'
          }
        },
        {
          path: 'presets',
          name: 'presets',
          component: PresetView,
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
          path: 'admin/users',
          name: 'admin-users',
          component: UserManagementView,
          meta: { title: '成员管理', requiresAdmin: true }
        },
        {
          path: 'admin/images',
          name: 'admin-images',
          component: AdminImageManagementView,
          meta: { title: '图片管理', requiresAdmin: true }
        },
        {
          path: 'shares',
          name: 'shares',
          component: ShareManagementView,
          meta: {
            title: '分享管理'
          }
        },
        {
          path: 'qq',
          name: 'qq-bridge',
          component: QqBridgeView,
          meta: { title: 'QQ 接入', requiresAdmin: true }
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingView,
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
        },
        {
          path: 'content-packs/import',
          name: 'content-pack-import',
          component: ContentPackImportView,
          meta: {
            title: '内容包导入'
          }
        }
      ]
    },
    // 兜底 404：匹配所有未命中的路径
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

router.beforeEach(async (to) => {
  if (to.name === 'login') return true;
  if (!getAccessToken()) return { name: 'login' };
  let user = getStoredCurrentUser();
  if (!user) {
    try {
      user = await fetchCurrentUser();
    } catch {
      logout();
      return { name: 'login' };
    }
  }
  if (to.meta.requiresAdmin && user.role !== 'admin') return { name: 'characters' };
  return true;
});
