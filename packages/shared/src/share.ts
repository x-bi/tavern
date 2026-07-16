export type ShareTargetType = 'conversation' | 'companion';
export type SharePermission = 'chat' | 'readonly';
export type ShareStatus = 'active' | 'revoked';
export type ShareLinkItem = {
  id: string;
  ownerUserId: string;
  owner: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  targetType: ShareTargetType;
  targetId: string;
  targetTitle: string | null;
  permission: SharePermission;
  status: ShareStatus;
  shareUrl: string | null;
  expiresAt: string | null;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};
export type CreateShareLinkPayload = {
  targetType: ShareTargetType;
  targetId: string;
  permission: SharePermission;
  expiresAt?: string | null;
};
export type PublicShareMessage = {
  messageId: string;
  role: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
export type PublicShareBootstrap = {
  shareId: string;
  targetType: ShareTargetType;
  permission: SharePermission;
  title: string;
  participantName: string;
  avatarUrl: string | null;
  expiresAt: string | null;
};
export type ShareTargetEventName =
  | 'message_created'
  | 'message_updated'
  | 'message_deleted'
  | 'generation_started'
  | 'delta'
  | 'generation_done'
  | 'generation_failed'
  | 'share_revoked';
export type ShareTargetEvent = { event: ShareTargetEventName; data: Record<string, unknown> };
