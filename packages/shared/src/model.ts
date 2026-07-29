import type { PageResult } from './pagination';

export type ModelCapability = 'chat' | 'image';

/** 连通性测试的响应体，记录一次真实探测的结果。 */
export type ModelConnectionTestResponse = {
  /** 是否连通成功。 */
  ok: boolean;
  /** 本次探测的往返耗时（毫秒）。 */
  latencyMs: number;
  /** 测试使用的供应商标识。 */
  providerName: string;
  /** 测试使用的模型名。 */
  modelName: string;
  /** 测试使用的基础 URL。 */
  baseUrl: string;
  /** 供应商返回的 HTTP 状态码；未拿到响应时为 null。 */
  statusCode: number | null;
  /** 测试结果说明（成功或错误描述）。 */
  message: string;
  /** 面向用户展示的简短摘要；无摘要时为 null。 */
  summary: string | null;
  /** 测试完成时间（ISO 字符串）。 */
  testedAt: string;
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

export type ModelProviderListResponse = PageResult<ModelProviderResponse>;

/** 当前 Model Gateway 已注册的供应商类型。 */
export type SupportedModelProvidersResponse = {
  items: string[];
};

export type ModelProviderPayload = {
  name: string;
  providerName: string;
  baseUrl: string;
  apiKey?: string | null;
  timeout?: number | null;
  isDefault?: boolean;
  isEnabled?: boolean;
};

export type ProviderModelResponse = {
  id: string;
  providerId: string;
  providerName: string;
  providerDisplayName: string;
  name: string;
  modelName: string;
  capability: ModelCapability;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  /** 模型自身显式覆盖的请求超时；null 表示继承供应商。 */
  timeout: number | null;
  /** 合并模型覆盖值和供应商默认值后的实际请求超时。 */
  effectiveTimeout: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  contextLength: number | null;
  supportsDeveloperRole: boolean;
  systemPlacement: 'initial_only' | 'midstream_allowed';
  supportsMultipleSystemMessages: boolean;
  requiresAlternatingRoles: boolean;
  tokenizerType: string;
  notes: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderModelListResponse = PageResult<ProviderModelResponse>;

export type ProviderModelPayload = {
  providerId: string;
  name: string;
  modelName: string;
  capability: ModelCapability;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  contextLength?: number | null;
  supportsDeveloperRole?: boolean;
  systemPlacement?: 'initial_only' | 'midstream_allowed';
  supportsMultipleSystemMessages?: boolean;
  requiresAlternatingRoles?: boolean;
  tokenizerType?: string;
  notes?: string | null;
  sortOrder?: number;
  isEnabled?: boolean;
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
  capability: ModelCapability;
  isDefault: boolean;
  isEnabled: boolean;
  candidates: ModelFallbackCandidateResponse[];
  createdAt: string;
  updatedAt: string;
};

export type ModelFallbackGroupListResponse = PageResult<ModelFallbackGroupResponse>;

export type ModelFallbackCandidatePayload = {
  modelId: string;
  priority: number;
  isEnabled?: boolean;
};

export type ModelFallbackGroupPayload = {
  name: string;
  capability: ModelCapability;
  isDefault?: boolean;
  isEnabled?: boolean;
  candidates: ModelFallbackCandidatePayload[];
};
