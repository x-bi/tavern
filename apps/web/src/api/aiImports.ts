import type {
  AiImportMode,
  AiImportOptionsResponse,
  AiImportTarget,
  AiImportTransformPayload,
  AiImportTransformResult,
  AiImportValidationResult,
  ModuleImportDuplicateNameStrategy
} from '@tavern/shared';

import { importCharacterJson } from './characters';
import { importCompanionJson } from './companions';
import { API_BASE_URL, authHeaders, requestJson } from './http';
import { importPersonaJson } from './personas';
import { importPromptPresetJson } from './presets';
import { importWorldBookJson } from './worldBooks';

export class AiImportApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'AiImportApiError';
  }
}

export async function fetchAiImportOptions(
  target: AiImportTarget,
  mode: AiImportMode
): Promise<AiImportOptionsResponse> {
  const query = new URLSearchParams({ target, mode });
  return unwrap(await requestJson<AiImportOptionsResponse>(`/ai-imports/options?${query}`));
}

export async function transformAiImport(
  payload: AiImportTransformPayload,
  signal?: AbortSignal
): Promise<AiImportTransformResult> {
  return unwrap(
    await requestJson<AiImportTransformResult>('/ai-imports/transform', {
      method: 'POST',
      body: payload,
      signal
    })
  );
}

export async function transformAiImportFile(
  payload: Omit<AiImportTransformPayload, 'sourceText'>,
  file: File,
  signal?: AbortSignal
): Promise<AiImportTransformResult> {
  const form = new FormData();
  form.set('target', payload.target);
  form.set('modelFallbackGroupId', payload.modelFallbackGroupId);
  form.set('mode', payload.mode);
  form.set('generalStrategyIds', JSON.stringify(payload.generalStrategyIds ?? []));
  form.set('moduleStrategyIds', JSON.stringify(payload.moduleStrategyIds ?? []));
  form.set('customInstructions', payload.customInstructions ?? '');
  form.set('file', file);
  const response = await fetch(`${API_BASE_URL}/ai-imports/transform-file`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    signal
  });
  const body = (await response.json()) as Awaited<
    ReturnType<typeof requestJson<AiImportTransformResult>>
  >;
  return unwrap(body);
}

export async function validateAiImportJson(
  target: AiImportTarget,
  rawJson: string
): Promise<AiImportValidationResult> {
  return unwrap(
    await requestJson<AiImportValidationResult>('/ai-imports/validate', {
      method: 'POST',
      body: { target, rawJson }
    })
  );
}

export async function commitAiImport(
  target: AiImportTarget,
  rawJson: string,
  duplicateNameStrategy: ModuleImportDuplicateNameStrategy
): Promise<unknown> {
  const options = { commit: true, duplicateNameStrategy };
  switch (target) {
    case 'character':
      return importCharacterJson({ rawJson, ...options });
    case 'persona':
      return importPersonaJson(rawJson, options);
    case 'prompt_preset':
      return importPromptPresetJson(rawJson, options);
    case 'world_book':
      return importWorldBookJson(rawJson, options);
    case 'companion':
      return importCompanionJson({ rawJson, ...options });
  }
}

function unwrap<T>(response: Awaited<ReturnType<typeof requestJson<T>>>): T {
  if (!response.success) {
    throw new AiImportApiError(response.error.message, response.error.code, response.error.details);
  }
  return response.data;
}
