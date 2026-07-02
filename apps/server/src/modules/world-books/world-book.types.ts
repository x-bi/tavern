export type WorldBookEntryInsertionOrder =
  | 'before_history'
  | 'after_history'
  | 'before_current_user_input'
  | 'after_current_user_input';

export type WorldBookEntryResponse = {
  id: string;
  worldBookId: string;
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords: string[];
  isEnabled: boolean;
  priority: number;
  insertionOrder: WorldBookEntryInsertionOrder;
  tokenBudget: number | null;
  caseSensitive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type WorldBookResponse = {
  id: string;
  userId: string;
  characterId: string | null;
  name: string;
  description: string;
  isEnabled: boolean;
  scanDepth: number;
  tokenBudget: number;
  metadata: Record<string, unknown> | null;
  entries: WorldBookEntryResponse[];
  createdAt: string;
  updatedAt: string;
};

export type WorldBookListResponse = {
  items: WorldBookResponse[];
  total: number;
  page: number;
  pageSize: number;
};
