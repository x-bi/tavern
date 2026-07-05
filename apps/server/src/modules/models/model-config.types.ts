/** 模型调用参数（采样/超时等，存为 JSON）。 */
export type ModelConfigParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
};

/** 模型配置对外响应（apiKey 不回传，仅含脱敏 mask）。 */
export type ModelConfigResponse = {
  id: string;
  userId: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  /** apiKey 脱敏展示串，如 `sk-****1234`。 */
  apiKeyMask: string | null;
  /** 是否已配置 apiKey。 */
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

/** 模型配置列表分页响应。 */
export type ModelConfigListResponse = {
  items: ModelConfigResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/** 测试连接的响应。 */
export type ModelConfigTestResponse = {
  ok: boolean;
  latencyMs: number;
  providerName: string;
  modelName: string;
  baseUrl: string;
  /** 远端 HTTP 状态码，未发请求时为 null。 */
  statusCode: number | null;
  message: string;
  summary: string | null;
  testedAt: string;
};

/** 调用模型网关所需的配置（含解密后的 apiKey 明文，仅内部使用）。 */
export type ModelGatewayConfig = {
  modelConfigId: string | null;
  providerModelId?: string | null;
  modelFallbackGroupId?: string | null;
  displayName?: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKey: string | null;
  params: ModelConfigParams;
};

export type ModelProviderResponse = {
  id: string;
  userId: string;
  name: string;
  providerName: string;
  baseUrl: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  timeout: number | null;
  isDefault: boolean;
  isEnabled: boolean;
  modelCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProviderModelResponse = {
  id: string;
  providerId: string;
  providerName: string;
  providerDisplayName: string;
  name: string;
  modelName: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeout: number | null;
  contextLength: number | null;
  notes: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ModelFallbackCandidateResponse = {
  id: string;
  groupId: string;
  modelId: string;
  priority: number;
  isEnabled: boolean;
  model: ProviderModelResponse;
};

export type ModelFallbackGroupResponse = {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  isEnabled: boolean;
  candidates: ModelFallbackCandidateResponse[];
  createdAt: string;
  updatedAt: string;
};
