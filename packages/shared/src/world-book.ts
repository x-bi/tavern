import type { PageResult } from './pagination';
import type { WorldBookEntryPosition } from './prompt-builder';

/** 世界书条目插入位置（重命名导出，语义同 WorldBookEntryPosition）。 */
export type WorldBookEntryInsertionOrder = WorldBookEntryPosition;

/** 单条世界书条目的响应体。 */
export type WorldBookEntryResponse = {
  /** 条目 ID。 */
  id: string;
  /** 所属世界书 ID。 */
  worldBookId: string;
  /** 条目标题。 */
  title: string;
  /** 条目正文（命中后注入 Prompt 的内容）。 */
  content: string;
  /** 主关键词列表（命中任一即激活条目）。 */
  keywords: string[];
  /** 次关键词列表（用于命中后的二次筛选）。 */
  secondaryKeywords: string[];
  /** 是否启用。 */
  isEnabled: boolean;
  /** 优先级，数值越大越优先注入。 */
  priority: number;
  /** 注入位置（相对历史消息与当前输入的前后）。 */
  insertionOrder: WorldBookEntryInsertionOrder;
  /** 条目 token 预算上限；未设置时为 null，沿用世界书预算。 */
  tokenBudget: number | null;
  /** 关键词匹配是否区分大小写。 */
  caseSensitive: boolean;
  /** 附加元数据；无则为 null。 */
  metadata: Record<string, unknown> | null;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 单本世界书的响应体，内含其全部条目。 */
export type WorldBookResponse = {
  /** 世界书 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 关联角色 ID 列表；为空时表示全局世界书。 */
  characterIds: string[];
  /** 世界书名称。 */
  name: string;
  /** 世界书描述。 */
  description: string;
  /** 是否启用。 */
  isEnabled: boolean;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  /** 扫描深度（往前看多少条消息用于关键词命中）。 */
  scanDepth: number;
  /** 整本世界书的 token 预算。 */
  tokenBudget: number;
  /** 附加元数据；无则为 null。 */
  metadata: Record<string, unknown> | null;
  /** 世界书下的条目列表。 */
  entries: WorldBookEntryResponse[];
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 世界书列表分页响应。 */
export type WorldBookListResponse = PageResult<WorldBookResponse>;

/** 创建 / 更新世界书的入参。 */
export type WorldBookPayload = {
  /** 关联角色 ID 列表；传空数组或省略表示全局世界书。 */
  characterIds?: string[];
  /** 世界书名称。 */
  name: string;
  /** 世界书描述。 */
  description?: string;
  /** 是否启用。 */
  isEnabled?: boolean;
  /** 是否标记为敏感内容；未传时默认 false。 */
  isSensitive?: boolean;
  isShared?: boolean;
  /** 扫描深度。 */
  scanDepth?: number;
  /** 整本世界书的 token 预算。 */
  tokenBudget?: number;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 更新世界书的入参，所有字段可选（部分更新）。 */
export type WorldBookUpdatePayload = Partial<WorldBookPayload>;

/** 创建 / 更新世界书条目的入参。 */
export type WorldBookEntryPayload = {
  /** 条目标题。 */
  title: string;
  /** 条目正文。 */
  content: string;
  /** 主关键词列表（必填，至少一个）。 */
  keywords: string[];
  /** 次关键词列表。 */
  secondaryKeywords?: string[];
  /** 是否启用。 */
  isEnabled?: boolean;
  /** 优先级。 */
  priority?: number;
  /** 注入位置。 */
  insertionOrder?: WorldBookEntryInsertionOrder;
  /** 条目 token 预算上限；传 null 表示未设置。 */
  tokenBudget?: number | null;
  /** 关键词匹配是否区分大小写。 */
  caseSensitive?: boolean;
  /** 附加元数据。 */
  metadata?: Record<string, unknown> | null;
};

/** 更新世界书条目的入参，所有字段可选（部分更新）。 */
export type WorldBookEntryUpdatePayload = Partial<WorldBookEntryPayload>;
