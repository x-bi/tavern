import type { PageResult } from './pagination';
import type { WorldBookEntryPosition } from './prompt-builder';

export type WorldBookEntryInsertionOrder = WorldBookEntryPosition;

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

export type WorldBookListResponse = PageResult<WorldBookResponse>;

export type WorldBookPayload = {
  characterId?: string | null;
  name: string;
  description?: string;
  isEnabled?: boolean;
  scanDepth?: number;
  tokenBudget?: number;
  metadata?: Record<string, unknown> | null;
};

export type WorldBookUpdatePayload = Partial<WorldBookPayload>;

export type WorldBookEntryPayload = {
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords?: string[];
  isEnabled?: boolean;
  priority?: number;
  insertionOrder?: WorldBookEntryInsertionOrder;
  tokenBudget?: number | null;
  caseSensitive?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type WorldBookEntryUpdatePayload = Partial<WorldBookEntryPayload>;
