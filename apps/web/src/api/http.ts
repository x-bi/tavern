import type { ApiResponse } from '@tavern/shared';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpRequestOptions = {
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function toApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export async function requestJson<T>(
  path: string,
  options: HttpRequestOptions = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(toApiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal
  });

  return response.json() as Promise<ApiResponse<T>>;
}
