export type ModelConfigParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
};

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

export type ModelConfigListResponse = {
  items: ModelConfigResponse[];
  total: number;
  page: number;
  pageSize: number;
};
