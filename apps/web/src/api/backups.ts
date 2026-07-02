import type { ApplicationBackupImportResponse } from '@tavern/shared';

import { requestJson } from './http';
import { toApiUrl } from './http';

export type BackupDownload = {
  blob: Blob;
  filename: string;
};

export class BackupClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'BackupClientError';
  }
}

type ApiErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export async function exportApplicationBackup(): Promise<BackupDownload> {
  const response = await fetch(toApiUrl('/backups/export'), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    await throwBackupError(response);
  }

  return {
    blob: await response.blob(),
    filename: getDownloadFilename(response.headers.get('Content-Disposition'))
  };
}

export async function importApplicationBackup(
  rawJson: string,
  confirmOverwrite: boolean
): Promise<ApplicationBackupImportResponse> {
  const response = await requestJson<ApplicationBackupImportResponse>('/backups/import', {
    method: 'POST',
    body: {
      rawJson,
      confirmOverwrite
    }
  });

  if (!response.success) {
    throw new BackupClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

async function throwBackupError(response: Response): Promise<never> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;

    if (payload.success === false) {
      throw new BackupClientError(payload.error.message, payload.error.code, payload.error.details);
    }
  } catch (error) {
    if (error instanceof BackupClientError) {
      throw error;
    }
  }

  throw new BackupClientError('备份导出失败。', `HTTP_${response.status}`);
}

function getDownloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return 'tavern-lite-backup.json';
  }

  const match = /filename="([^"]+)"/.exec(contentDisposition);

  return match?.[1] ?? 'tavern-lite-backup.json';
}
