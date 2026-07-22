import type { PageResult } from './pagination';

/** 用户 Persona（人设）的响应体。 */
export type PersonaResponse = {
  /** Persona ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** Persona 名称。 */
  name: string;
  /** Persona 正文（人设描述）。 */
  content: string;
  coreIdentity: string;
  background: string;
  interactionPreferences: string;
  /** 附加元数据；无则为 null。 */
  metadata: Record<string, unknown> | null;
  /** 是否为当前用户的默认 Persona。 */
  isDefault: boolean;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** Persona 列表分页响应。 */
export type PersonaListResponse = PageResult<PersonaResponse>;

/**
 * 创建 / 更新 Persona 的入参。
 *
 * `isDefault=true` 时会把本 Persona 设为用户默认，其余自动取消默认。
 */
export type PersonaPayload = {
  /** Persona 名称。 */
  name: string;
  /** Persona 正文，未传时后端按空字符串处理。 */
  content?: string;
  coreIdentity?: string;
  background?: string;
  interactionPreferences?: string;
  /** 附加元数据。 */
  metadata?: Record<string, unknown>;
  /** 是否设为默认 Persona。 */
  isDefault?: boolean;
  /** 是否标记为敏感内容；未传时默认 false。 */
  isSensitive?: boolean;
  isShared?: boolean;
};
