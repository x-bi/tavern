import type { ApiResponse } from '@tavern/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type Asset = {
  id: string;
  userId: string;
  kind: string;
  fileName: string;
  originalName: string | null;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  publicPath: string | null;
  createdAt: string;
};

export class AssetClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'AssetClientError';
  }
}

export async function uploadAsset(file: File): Promise<Asset> {
  const body = new FormData();

  body.set('file', file);

  const response = await fetch(`${API_BASE_URL}/assets/upload`, {
    method: 'POST',
    body
  });
  const payload = (await response.json()) as ApiResponse<Asset>;

  if (!payload.success) {
    throw new AssetClientError(
      payload.error.message,
      payload.error.code,
      payload.error.details
    );
  }

  return payload.data;
}
