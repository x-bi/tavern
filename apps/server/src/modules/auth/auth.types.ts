import type { CurrentUser } from '../users/user.types';

export type AuthMode = 'single_user';

export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  currentUser?: CurrentUser;
};

export type AuthUserResponse = CurrentUser;

export type LoginResponse = {
  user: AuthUserResponse;
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
};
