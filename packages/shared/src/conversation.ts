import type { PageResult } from './pagination';

/** 会话状态：活跃进行中或已归档。 */
export type ConversationStatus = 'active' | 'archived';

/** 会话关联角色的摘要信息（列表/详情场景用，避免回传完整角色卡）。 */
export type ConversationCharacterSummary = {
  /** 角色 ID。 */
  id: string;
  /** 角色名。 */
  name: string;
  /** 角色头像资源 ID；无头像时为 null。 */
  avatarAssetId: string | null;
  /** 角色头像访问 URL；无头像时为 null。 */
  avatarUrl: string | null;
};

/** 会话关联 Persona 的摘要信息。 */
export type ConversationPersonaSummary = {
  /** Persona ID。 */
  id: string;
  /** Persona 名称。 */
  name: string;
};

/** 会话关联模型链摘要。 */
export type ConversationModelFallbackGroupSummary = {
  /** 模型链 ID。 */
  id: string;
  /** 模型链名称。 */
  name: string;
  /** 是否启用。 */
  isEnabled: boolean;
  /** 候选模型数量。 */
  candidateCount: number;
};

/** 会话关联 Prompt 预设的摘要信息。 */
export type ConversationPromptPresetSummary = {
  /** 预设 ID。 */
  id: string;
  /** 预设名称。 */
  name: string;
};

/** 单个会话的响应体，附带关联实体的摘要。 */
export type ConversationResponse = {
  /** 会话 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 关联角色 ID。 */
  characterId: string;
  /** 关联模型链 ID；未绑定或绑定后删除时为 null。 */
  modelFallbackGroupId: string | null;
  /** 关联 Prompt 预设 ID；未绑定时为 null。 */
  promptPresetId: string | null;
  /** 关联 Persona ID；未绑定时为 null。 */
  personaId: string | null;
  /** 会话标题。 */
  title: string;
  /** 会话状态（标准状态之外的字符串视为自定义状态）。 */
  status: ConversationStatus | string;
  /** 附加元数据；无则为 null。 */
  metadata: Record<string, unknown> | null;
  /** 是否引用了敏感角色、预设或 Persona。 */
  usesSensitiveResource: boolean;
  /** 最近一条消息时间（ISO 字符串）；新会话无消息时为 null。 */
  lastMessageAt: string | null;
  /** 关联角色摘要。 */
  character: ConversationCharacterSummary;
  /** 关联 Persona 摘要；未绑定时为 null。 */
  persona: ConversationPersonaSummary | null;
  /** 关联模型链摘要；未绑定时为 null。 */
  modelFallbackGroup: ConversationModelFallbackGroupSummary | null;
  /** 关联 Prompt 预设摘要；未绑定时为 null。 */
  promptPreset: ConversationPromptPresetSummary | null;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 会话列表分页响应。 */
export type ConversationListResponse = PageResult<ConversationResponse>;

/** 创建会话的入参。 */
export type ConversationPayload = {
  /** 会话标题。 */
  title: string;
  /** 关联角色 ID。 */
  characterId: string;
  /** 关联模型链 ID；未绑定时传 null 或省略。 */
  modelFallbackGroupId?: string | null;
  /** 关联 Prompt 预设 ID；未绑定时传 null 或省略。 */
  promptPresetId?: string | null;
  /** 关联 Persona ID；未绑定时传 null 或省略。 */
  personaId?: string | null;
  /** 会话状态，默认 active。 */
  status?: ConversationStatus;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 更新会话的入参，所有字段可选（部分更新）。 */
export type ConversationUpdatePayload = Partial<ConversationPayload>;

/** 清空会话消息的响应体。 */
export type ConversationClearResponse = {
  /** 固定为 true，表示清空成功。 */
  cleared: true;
  /** 会话 ID。 */
  id: string;
  /** 被删除（软删除）的消息条数。 */
  deletedMessages: number;
};
