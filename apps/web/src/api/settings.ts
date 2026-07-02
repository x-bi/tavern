import type { ApiResponse } from '@tavern/shared';

import { toApiUrl } from './http';

export type ApplicationSettings = {
  workspaceName: string;
  autoOpenLastConversation: boolean;
  compactListMode: boolean;
  defaultHistoryLimit: number;
};

export type ApplicationSettingsPayload = ApplicationSettings;

export class SettingsApiUnsupportedError extends Error {
  constructor() {
    super('当前后端未启用设置 API。');
    this.name = 'SettingsApiUnsupportedError';
  }
}

export class SettingsClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'SettingsClientError';
  }
}

export async function fetchApplicationSettings(): Promise<ApplicationSettings> {
  const response = await fetch(toApiUrl('/settings'), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  return parseSettingsResponse(response);
}

export async function updateApplicationSettings(
  payload: ApplicationSettingsPayload
): Promise<ApplicationSettings> {
  const response = await fetch(toApiUrl('/settings'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseSettingsResponse(response);
}

async function parseSettingsResponse(response: Response): Promise<ApplicationSettings> {
  if (response.status === 404) {
    throw new SettingsApiUnsupportedError();
  }

  const payload = (await response.json()) as ApiResponse<ApplicationSettings>;

  if (!response.ok || !payload.success) {
    throw new SettingsClientError(
      payload.success ? '设置 API 请求失败。' : payload.error.message,
      payload.success ? `HTTP_${response.status}` : payload.error.code,
      payload.success ? undefined : payload.error.details
    );
  }

  return payload.data;
}
