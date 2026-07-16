import type {
  CreateShareLinkPayload,
  ShareLinkItem,
  SharePermission,
  ShareTargetType
} from '@tavern/shared';
import { requestJson } from './http';

type ShareList = { items: ShareLinkItem[]; total: number; page: number; pageSize: number };
function unwrap<T>(response: Awaited<ReturnType<typeof requestJson<T>>>) {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}
export async function listShares(targetType?: ShareTargetType, targetId?: string) {
  const query = new URLSearchParams();
  if (targetType) query.set('targetType', targetType);
  if (targetId) query.set('targetId', targetId);
  const suffix = query.size ? `?${query.toString()}` : '';

  return unwrap(await requestJson<ShareList>(`/shares${suffix}`));
}
export async function createShare(payload: CreateShareLinkPayload) {
  return unwrap(await requestJson<ShareLinkItem>('/shares', { method: 'POST', body: payload }));
}
export async function updateShare(
  id: string,
  payload: { permission?: SharePermission; expiresAt?: string | null }
) {
  return unwrap(
    await requestJson<ShareLinkItem>(`/shares/${id}`, { method: 'PUT', body: payload })
  );
}
export async function revokeShare(id: string) {
  return unwrap(
    await requestJson<{ revoked: true; id: string }>(`/shares/${id}`, { method: 'DELETE' })
  );
}
export async function regenerateShare(id: string) {
  return unwrap(await requestJson<ShareLinkItem>(`/shares/${id}/regenerate`, { method: 'POST' }));
}
export async function bulkRevokeShares(targetType: ShareTargetType, targetId: string) {
  return unwrap(
    await requestJson<{ revokedCount: number }>('/shares/bulk-revoke', {
      method: 'POST',
      body: { targetType, targetId }
    })
  );
}
