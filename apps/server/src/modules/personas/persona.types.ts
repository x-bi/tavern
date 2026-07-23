/** 用户人设对外响应。 */
export type PersonaResponse = {
  id: string;
  userId: string;
  name: string;
  coreIdentity: string;
  background: string;
  interactionPreferences: string;
  /** 扩展元数据，可为 null。 */
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 人设列表分页响应。 */
export type PersonaListResponse = {
  items: PersonaResponse[];
  total: number;
  page: number;
  pageSize: number;
};
