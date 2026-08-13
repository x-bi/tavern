export type QqTargetType = 'conversation' | 'companion';
export type QqAccountStatus = 'unknown' | 'online' | 'offline' | 'error';

export type QqAccountItem = {
  id: string;
  label: string;
  apiBaseUrl: string;
  webUiUrl: string | null;
  qqUin: string | null;
  nickname: string | null;
  accessTokenMask: string | null;
  hasAccessToken: boolean;
  status: QqAccountStatus;
  isEnabled: boolean;
  callbackUrl: string;
  lastConnectedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QqAccountPayload = {
  label: string;
  apiBaseUrl: string;
  webUiUrl?: string | null;
  accessToken?: string | null;
  isEnabled?: boolean;
};

export type QqFriendItem = {
  qqUin: string;
  nickname: string;
  remark: string | null;
  displayName: string;
};

export type QqTargetItem = {
  targetType: QqTargetType;
  targetId: string;
  title: string;
  subtitle: string | null;
  bindingId: string | null;
  boundPeerQqUin: string | null;
  boundPeerNickname: string | null;
};

export type QqChatBindingItem = {
  id: string;
  qqAccountId: string;
  accountLabel: string;
  accountQqUin: string | null;
  peerQqUin: string;
  peerNickname: string | null;
  targetType: QqTargetType;
  targetId: string;
  targetTitle: string;
  isEnabled: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QqChatBindingPayload = {
  qqAccountId: string;
  peerQqUin: string;
  peerNickname?: string | null;
  targetType: QqTargetType;
  targetId: string;
};

export type QqBindingUpdatePayload = {
  targetType: QqTargetType;
  targetId: string;
};

export type QqConnectionTestResult = {
  ok: boolean;
  qqUin: string | null;
  nickname: string | null;
  message: string;
};

export type QqLoginStatus = {
  state: 'waiting' | 'online';
  account: QqAccountItem | null;
  qrCodeDataUrl: string | null;
  qrCodeUpdatedAt: string | null;
  message: string;
};

export type QqLogoutResult = {
  accountId: string;
  qqUin: string;
  message: string;
};
