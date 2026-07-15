/** 侧边栏导航项。 */
export type NavigationItem = {
  /** 路由路径。 */
  path: string;
  /** 菜单显示文本。 */
  label: string;
};

/** 侧边栏导航项列表，AppLayout 据此渲染 n-menu。 */
export const navigationItems: NavigationItem[] = [
  {
    path: '/characters',
    label: '角色'
  },
  {
    path: '/companion',
    label: 'AI 角色'
  },
  {
    path: '/conversations',
    label: '会话'
  },
  {
    path: '/chat',
    label: '聊天'
  },
  {
    path: '/models',
    label: '模型'
  },
  {
    path: '/presets',
    label: '预设'
  },
  {
    path: '/persona',
    label: 'Persona'
  },
  {
    path: '/worldbook',
    label: '世界书'
  },
  {
    path: '/prompt-preview',
    label: 'Prompt 预览'
  },
  {
    path: '/settings',
    label: '设置'
  },
  {
    path: '/content-packs/import',
    label: '内容包'
  },
  {
    path: '/backup',
    label: '备份'
  }
];
