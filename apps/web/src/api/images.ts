import type {
  AdminImageDetailResponse,
  AdminImageListResponse,
  ConversationMessageImagesResponse,
  CreateImageGenerationPayload,
  ImageDetailResponse,
  ImageGenerationBatchResponse,
  ImageListResponse
} from '@tavern/shared';

import { ApiClientError } from './models';
import { requestJson } from './http';

function unwrap<T>(response: Awaited<ReturnType<typeof requestJson<T>>>): T {
  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }
  return response.data;
}

export async function fetchConversationMessageImages(
  conversationId: string
): Promise<ConversationMessageImagesResponse> {
  return unwrap(await requestJson(`/conversations/${conversationId}/message-images`));
}

export async function createMessageImageGeneration(
  messageId: string,
  payload: CreateImageGenerationPayload
): Promise<ImageGenerationBatchResponse> {
  return unwrap(
    await requestJson(`/messages/${messageId}/image-generations`, {
      method: 'POST',
      body: payload
    })
  );
}

export async function regenerateImageBatch(
  batchId: string,
  payload: CreateImageGenerationPayload
): Promise<ImageGenerationBatchResponse> {
  return unwrap(
    await requestJson(`/image-generation-batches/${batchId}/regenerate`, {
      method: 'POST',
      body: payload
    })
  );
}

export async function fetchImageGenerationBatch(
  batchId: string
): Promise<ImageGenerationBatchResponse> {
  return unwrap(await requestJson(`/image-generation-batches/${batchId}`));
}

export async function fetchRunningImageBatches(
  conversationId: string
): Promise<ImageGenerationBatchResponse[]> {
  return unwrap(
    await requestJson(`/conversations/${conversationId}/image-generation-batches?status=running`)
  );
}

export async function cancelImageGeneration(
  batchId: string
): Promise<ImageGenerationBatchResponse> {
  return unwrap(
    await requestJson(`/image-generation-batches/${batchId}/cancel`, { method: 'POST' })
  );
}

export async function fetchImages(query = ''): Promise<ImageListResponse> {
  return unwrap(await requestJson(`/images${query}`));
}

export async function fetchImageDetail(id: string): Promise<ImageDetailResponse> {
  return unwrap(await requestJson(`/images/${id}`));
}

export async function deleteImage(id: string): Promise<{ deleted: true; id: string }> {
  return unwrap(await requestJson(`/images/${id}`, { method: 'DELETE' }));
}

export async function fetchAdminImages(query = ''): Promise<AdminImageListResponse> {
  return unwrap(await requestJson(`/admin/images${query}`));
}

export async function fetchAdminImageDetail(id: string): Promise<AdminImageDetailResponse> {
  return unwrap(await requestJson(`/admin/images/${id}`));
}
