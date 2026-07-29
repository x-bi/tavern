/** 模型调用参数（采样/超时等，存为 JSON）。 */
export type ModelCapability = 'chat' | 'image';

export type ModelGenerationParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
  /** 频率惩罚（0~2），降低已出现 token 的重复概率，抑制套话循环。 */
  frequencyPenalty?: number;
  /** 存在惩罚（0~2），鼓励引入新内容，缓解长会话同质化。 */
  presencePenalty?: number;
};

/** 测试连接的响应。 */
export type ModelConnectionTestResponse = {
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
  providerModelId?: string | null;
  modelFallbackGroupId?: string | null;
  displayName?: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  capability: ModelCapability;
  apiKey: string | null;
  contextLength?: number | null;
  capabilities: {
    supportsDeveloperRole: boolean;
    systemPlacement: 'initial_only' | 'midstream_allowed';
    supportsMultipleSystemMessages: boolean;
    requiresAlternatingRoles: boolean;
    contextWindowTokens: number;
    tokenizerType: string;
  };
  params: ModelGenerationParams;
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
