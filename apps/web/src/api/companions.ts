import type {
  CompanionChatStreamPayload,
  CompanionExportResponse,
  CompanionImportResponse,
  CompanionImportTemplateResponse,
  CompanionListResponse,
  CompanionMemoryPayload,
  CompanionMemoryResponse,
  CompanionMessageResponse,
  CompanionPayload,
  CompanionPromptPreviewResponse,
  CompanionResponse,
  ContentLibraryScope
} from '@tavern/shared';
import { API_BASE_URL, authHeaders, requestJson } from './http';

function unwrap<T>(response: Awaited<ReturnType<typeof requestJson<T>>>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}
export async function fetchCompanions(search = '', scope: ContentLibraryScope = 'owned') {
  return unwrap(
    await requestJson<CompanionListResponse>(
      `/companions?page=1&pageSize=100&scope=${scope}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    )
  );
}
export async function forkCompanion(id: string) {
  return unwrap(await requestJson<CompanionResponse>(`/companions/${id}/fork`, { method: 'POST' }));
}
export async function fetchCompanion(id: string) {
  return unwrap(await requestJson<CompanionResponse>(`/companions/${id}`));
}
export async function createCompanion(payload: CompanionPayload) {
  return unwrap(
    await requestJson<CompanionResponse>('/companions', { method: 'POST', body: payload })
  );
}
export async function updateCompanion(id: string, payload: Partial<CompanionPayload>) {
  return unwrap(
    await requestJson<CompanionResponse>(`/companions/${id}`, { method: 'PUT', body: payload })
  );
}
export async function deleteCompanion(id: string) {
  return unwrap(
    await requestJson<{ deleted: true; id: string }>(`/companions/${id}`, { method: 'DELETE' })
  );
}
export async function importCompanionJson(payload: {
  rawJson: string;
  commit?: boolean;
  duplicateNameStrategy?: 'reject' | 'rename';
}) {
  return unwrap(
    await requestJson<CompanionImportResponse>('/companions/import', {
      method: 'POST',
      body: payload
    })
  );
}
export async function fetchCompanionImportTemplate() {
  return unwrap(await requestJson<CompanionImportTemplateResponse>('/companions/import-template'));
}
export async function exportCompanionJson(id: string) {
  return unwrap(await requestJson<CompanionExportResponse>(`/companions/${id}/export`));
}
export async function fetchCompanionMessages(id: string) {
  return unwrap(await requestJson<CompanionMessageResponse[]>(`/companions/${id}/messages`));
}
export async function updateCompanionMessage(id: string, content: string) {
  return unwrap(
    await requestJson<CompanionMessageResponse>(`/companion-messages/${id}`, {
      method: 'PUT',
      body: { content }
    })
  );
}
export async function deleteCompanionMessage(id: string) {
  return unwrap(
    await requestJson<{ deleted: true; id: string }>(`/companion-messages/${id}`, {
      method: 'DELETE'
    })
  );
}
export async function regenerateCompanionMessage(id: string) {
  return unwrap(
    await requestJson<{ id: string; companionId: string; regenerateMessageId: string }>(
      `/companion-messages/${id}/regenerate`,
      { method: 'POST' }
    )
  );
}
export async function fetchCompanionMemory(id: string) {
  return unwrap(await requestJson<CompanionMemoryResponse>(`/companions/${id}/memory`));
}
export async function updateCompanionMemory(id: string, payload: CompanionMemoryPayload) {
  return unwrap(
    await requestJson<CompanionMemoryResponse>(`/companions/${id}/memory`, {
      method: 'PUT',
      body: payload
    })
  );
}
export async function clearCompanionMemory(id: string) {
  return unwrap(
    await requestJson<{ cleared: true; companionId: string }>(`/companions/${id}/memory`, {
      method: 'DELETE'
    })
  );
}
export async function refreshCompanionMemory(id: string) {
  return unwrap(
    await requestJson<{ scheduled: boolean }>(`/companions/${id}/memory/refresh`, {
      method: 'POST'
    })
  );
}
export async function restoreCompanionMemory(id: string, revisionId: string) {
  return unwrap(
    await requestJson<CompanionMemoryResponse>(`/companions/${id}/memory/restore/${revisionId}`, {
      method: 'POST'
    })
  );
}
export async function previewCompanionPrompt(id: string, userMessage: string) {
  return unwrap(
    await requestJson<CompanionPromptPreviewResponse>(`/companions/${id}/prompt-preview`, {
      method: 'POST',
      body: { userMessage }
    })
  );
}
export async function startCompanionChat(
  id: string,
  payload: CompanionChatStreamPayload,
  signal?: AbortSignal
) {
  const response = await fetch(`${API_BASE_URL}/companions/${id}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) throw new Error(`Companion chat failed (${response.status}).`);
  return response;
}
