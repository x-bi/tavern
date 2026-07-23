/** 世界书条目的插入位置（决定条目内容插入到 prompt 的哪个位置）。 */
export type WorldBookEntryInsertionOrder =
  | 'before_history' // 历史消息前
  | 'after_history' // 历史消息后
  | 'before_current_user_input' // 当前用户输入前
  | 'after_current_user_input'; // 当前用户输入后

/** 世界书条目对外响应。 */
export type WorldBookEntryResponse = {
  id: string;
  activeRevisionId: string;
  contentType: string;
  trustLevel: string;
  activationMode: string;
  matchMode: string;
  primaryLogic: string;
  secondaryLogic: string;
  excludeKeywords: string[];
  sameMessageOnly: boolean;
  scanSources: string[];
  userHistoryScanDepth: number;
  stickyTurns: number;
  continuationTurns: number;
  cooldownTurns: number;
  delayTurns: number;
  cooldownPolicy: string;
  generationPurposes: string[];
  budgetPriority: number;
  sortOrder: number;
  compactContent: string | null;
  compactSourceHash: string | null;
  compactStale: boolean;
  worldBookId: string;
  title: string;
  content: string;
  /** 触发关键词（命中即插入该条目）。 */
  keywords: string[];
  /** 次要关键词。 */
  secondaryKeywords: string[];
  isEnabled: boolean;
  insertionOrder: WorldBookEntryInsertionOrder;
  /** 条目独立 token 预算，为 null 时用世界书的。 */
  tokenBudget: number | null;
  createdAt: string;
  updatedAt: string;
};

/** 世界书对外响应（含条目）。 */
export type WorldBookResponse = {
  id: string;
  userId: string;
  /** 关联角色 ID 列表；为空表示全局世界书（所有角色共享）。 */
  characterIds: string[];
  personaIds: string[];
  conversationIds: string[];
  companionIds: string[];
  name: string;
  description: string;
  isEnabled: boolean;
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  /** 扫描深度（扫描最近 N 条消息触发关键词）。 */
  scanDepth: number;
  /** token 预算（世界书最多占用多少 token）。 */
  tokenBudget: number;
  metadata: Record<string, unknown> | null;
  entries: WorldBookEntryResponse[];
  createdAt: string;
  updatedAt: string;
};

/** 世界书列表分页响应。 */
export type WorldBookListResponse = {
  items: WorldBookResponse[];
  total: number;
  page: number;
  pageSize: number;
};
