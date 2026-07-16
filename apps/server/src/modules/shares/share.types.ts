import type { CurrentUser } from '../users/user.types';

export type ShareTargetType = 'conversation' | 'companion';
export type SharePermission = 'chat' | 'readonly';
export type ShareContext = {
  shareId: string;
  ownerUserId: string;
  targetType: ShareTargetType;
  targetId: string;
  permission: SharePermission;
  expiresAt: Date | null;
  owner: CurrentUser;
};

export type ShareRequest = {
  params: { token?: string };
  ip?: string;
  shareContext?: ShareContext;
};
