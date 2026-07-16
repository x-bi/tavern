import { clearAccessToken, requestJson, setAccessToken } from './http';

export type AuthUser = { id: string; username: string; displayName: string; role: 'admin' | 'member' };
type LoginResult = { user: AuthUser; accessToken: string; expiresAt: string };
const CURRENT_USER_KEY = 'tavern.current-user';

export function getStoredCurrentUser(): AuthUser | null {
  const value = sessionStorage.getItem(CURRENT_USER_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as AuthUser; } catch { sessionStorage.removeItem(CURRENT_USER_KEY); return null; }
}

function storeCurrentUser(user: AuthUser): void {
  sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await requestJson<LoginResult>('/auth/login', { method: 'POST', body: { username, password } });
  if (!response.success || !response.data) throw new Error(response.error?.message ?? '登录失败。');
  setAccessToken(response.data.accessToken);
  storeCurrentUser(response.data.user);
  return response.data.user;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await requestJson<AuthUser>('/auth/me');
  if (!response.success || !response.data) throw new Error(response.error?.message ?? '登录已失效。');
  storeCurrentUser(response.data);
  return response.data;
}

export function logout(): void { clearAccessToken(); sessionStorage.removeItem(CURRENT_USER_KEY); }
