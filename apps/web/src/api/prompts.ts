import { requestJson } from './http';
import type { PromptPreviewPayload, PromptPreviewResponse } from '@tavern/shared';

export type PromptPreviewRequest = PromptPreviewPayload;
export type PromptPreview = PromptPreviewResponse;

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function previewPrompt(payload: PromptPreviewRequest): Promise<PromptPreview> {
  const response = await requestJson<PromptPreviewResponse>('/prompts/preview', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}
