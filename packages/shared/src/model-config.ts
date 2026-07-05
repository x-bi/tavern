import type { PageResult } from './pagination';

/** 模型配置的响应体（出参时 API Key 已掩码，不返回明文）。 */
export type ModelConfigResponse = {
  /** 配置 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 配置名称。 */
  name: string;
  /** 供应商标识，如 `openai`、`deepseek`、`openrouter`。 */
  providerName: string;
  /** 模型 API 的基础 URL。 */
  baseUrl: string;
  /** 模型名，如 `gpt-4o-mini`。 */
  modelName: string;
  /** API Key 掩码字符串（如 `sk-****abcd`）；未配置 Key 时为 null。 */
  apiKeyMask: string | null;
  /** 是否已配置过 API Key（前端据此决定是否要求用户补填）。 */
  hasApiKey: boolean;
  /** 采样温度；未设置时为 null。 */
  temperature: number | null;
  /** top_p；未设置时为 null。 */
  topP: number | null;
  /** 最大输出 token 数；未设置时为 null。 */
  maxTokens: number | null;
  /** 请求超时时间（毫秒）；未设置时为 null。 */
  timeout: number | null;
  /** 是否为默认模型配置。 */
  isDefault: boolean;
  /** 是否启用（停用的配置不会被会话选用）。 */
  isEnabled: boolean;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 模型配置列表分页响应。 */
export type ModelConfigListResponse = PageResult<ModelConfigResponse>;

/** 连通性测试的响应体，记录一次真实探测的结果。 */
export type ModelConfigTestResponse = {
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

/**
 * 创建 / 更新模型配置的入参。
 *
 * `apiKey` 仅在表单单次提交时传递；后端返回时不会回传明文，前端不应持久保留。
 */
export type ModelConfigPayload = {
  /** 配置名称。 */
  name: string;
  /** 供应商标识。 */
  providerName: string;
  /** 模型 API 的基础 URL。 */
  baseUrl: string;
  /** 模型名。 */
  modelName: string;
  /** API Key 明文，仅提交时使用；不传表示不更新 Key。 */
  apiKey?: string | null;
  /** 采样温度。 */
  temperature?: number;
  /** top_p。 */
  topP?: number;
  /** 最大输出 token 数。 */
  maxTokens?: number;
  /** 请求超时时间（毫秒）。 */
  timeout?: number;
  /** 是否设为默认模型配置。 */
  isDefault?: boolean;
  /** 是否启用。 */
  isEnabled?: boolean;
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

export type ProviderModelListResponse = PageResult<ProviderModelResponse>;

export type ProviderModelPayload = {
  providerId: string;
  name: string;
  modelName: string;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeout?: number | null;
  contextLength?: number | null;
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
  isDefault?: boolean;
  isEnabled?: boolean;
  candidates: ModelFallbackCandidatePayload[];
};
