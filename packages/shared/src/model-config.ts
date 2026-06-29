import type { PageResult } from './pagination';

export type ModelConfigResponse = {
  id: string;
  userId: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeout: number | null;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ModelConfigListResponse = PageResult<ModelConfigResponse>;

export type ModelConfigPayload = {
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string | null;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
  isDefault?: boolean;
  isEnabled?: boolean;
};
