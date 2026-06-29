export type NavigationItem = {
  path: string;
  label: string;
};

export const navigationItems: NavigationItem[] = [
  {
    path: '/characters',
    label: '角色'
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
    path: '/backup',
    label: '备份'
  }
];
