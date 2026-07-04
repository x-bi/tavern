/** 会话状态：active 活跃 / archived 已归档。 */
export type ConversationStatus = 'active' | 'archived';

/** 会话关联的角色摘要。 */
export type ConversationCharacterSummary = {
  id: string;
  name: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
};

/** 会话关联的人设摘要。 */
export type ConversationPersonaSummary = {
  id: string;
  name: string;
};

/** 会话关联的模型配置摘要。 */
export type ConversationModelConfigSummary = {
  id: string;
  name: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
};

/** 会话关联的预设摘要。 */
export type ConversationPromptPresetSummary = {
  id: string;
  name: string;
};

/** 会话对外响应（含各关联实体的摘要）。 */
export type ConversationResponse = {
  id: string;
  userId: string;
  characterId: string;
  modelConfigId: string | null;
  promptPresetId: string | null;
  personaId: string | null;
  title: string;
  status: string;
  metadata: Record<string, unknown> | null;
  /** 最后一条消息时间，无消息时为 null。 */
  lastMessageAt: string | null;
  character: ConversationCharacterSummary;
  persona: ConversationPersonaSummary | null;
  modelConfig: ConversationModelConfigSummary | null;
  promptPreset: ConversationPromptPresetSummary | null;
  createdAt: string;
  updatedAt: string;
};

/** 会话列表分页响应。 */
export type ConversationListResponse = {
  items: ConversationResponse[];
  total: number;
  page: number;
  pageSize: number;
};

/** 清空会话消息的响应。 */
export type ConversationClearResponse = {
  cleared: true;
  id: string;
  /** 被删除的消息数。 */
  deletedMessages: number;
};
