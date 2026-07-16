import { requestJson } from './http';
import type { ApiResponse } from '@tavern/shared';

export type UserRole = 'admin' | 'member';
export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
};
export type ManagedUserList = { items: ManagedUser[]; total: number; page: number; pageSize: number };
export type CreateManagedUserInput = { username: string; displayName: string; password: string; role: UserRole };
export type UpdateManagedUserInput = Partial<CreateManagedUserInput>;

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const result = await request;
  if (!result.success || result.data === null) throw new Error(result.error?.message ?? '请求失败。');
  return result.data;
}

export const fetchManagedUsers = () => unwrap(requestJson<ManagedUserList>('/admin/users'));
export const createManagedUser = (body: CreateManagedUserInput) => unwrap(requestJson<ManagedUser>('/admin/users', { method: 'POST', body }));
export const getManagedUser = (id: string) => unwrap(requestJson<ManagedUser>(`/admin/users/${id}`));
export const updateManagedUser = (id: string, body: UpdateManagedUserInput) => unwrap(requestJson<ManagedUser>(`/admin/users/${id}`, { method: 'PUT', body }));
export const deleteManagedUser = (id: string) => unwrap(requestJson<{ deleted: true; id: string }>(`/admin/users/${id}`, { method: 'DELETE' }));
