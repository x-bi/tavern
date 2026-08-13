import type {
  QqAccountItem,
  QqAccountPayload,
  QqBindingUpdatePayload,
  QqChatBindingItem,
  QqChatBindingPayload,
  QqConnectionTestResult,
  QqFriendItem,
  QqLoginStatus,
  QqLogoutResult,
  QqTargetItem
} from '@tavern/shared';
import { requestJson } from './http';

type ListResult<T> = { items: T[]; total: number; page: number; pageSize: number };

function unwrap<T>(response: Awaited<ReturnType<typeof requestJson<T>>>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export async function listQqAccounts() {
  return unwrap(await requestJson<ListResult<QqAccountItem>>('/qq/accounts'));
}
export async function getQqLoginStatus() {
  return unwrap(await requestJson<QqLoginStatus>('/qq/login/status'));
}
export async function createQqAccount(payload: QqAccountPayload) {
  return unwrap(
    await requestJson<QqAccountItem>('/qq/accounts', { method: 'POST', body: payload })
  );
}
export async function updateQqAccount(id: string, payload: Partial<QqAccountPayload>) {
  return unwrap(
    await requestJson<QqAccountItem>(`/qq/accounts/${id}`, { method: 'PUT', body: payload })
  );
}
export async function deleteQqAccount(id: string) {
  return unwrap(
    await requestJson<{ deleted: true; id: string }>(`/qq/accounts/${id}`, { method: 'DELETE' })
  );
}
export async function testQqAccount(id: string) {
  return unwrap(
    await requestJson<QqConnectionTestResult>(`/qq/accounts/${id}/test`, { method: 'POST' })
  );
}
export async function logoutQqAccount(id: string) {
  return unwrap(await requestJson<QqLogoutResult>(`/qq/accounts/${id}/logout`, { method: 'POST' }));
}
export async function listQqFriends(id: string) {
  return unwrap(await requestJson<ListResult<QqFriendItem>>(`/qq/accounts/${id}/friends`));
}
export async function listQqTargets() {
  return unwrap(await requestJson<{ items: QqTargetItem[] }>('/qq/targets'));
}
export async function listQqBindings() {
  return unwrap(await requestJson<ListResult<QqChatBindingItem>>('/qq/bindings'));
}
export async function createQqBinding(payload: QqChatBindingPayload) {
  return unwrap(
    await requestJson<QqChatBindingItem>('/qq/bindings', { method: 'POST', body: payload })
  );
}
export async function switchQqBinding(id: string, payload: QqBindingUpdatePayload) {
  return unwrap(
    await requestJson<QqChatBindingItem>(`/qq/bindings/${id}`, { method: 'PUT', body: payload })
  );
}
export async function deleteQqBinding(id: string) {
  return unwrap(
    await requestJson<{ deleted: true; id: string }>(`/qq/bindings/${id}`, { method: 'DELETE' })
  );
}
