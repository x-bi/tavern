import type { PageResult } from './pagination';

export type PersonaResponse = {
  id: string;
  userId: string;
  name: string;
  content: string;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonaListResponse = PageResult<PersonaResponse>;

export type PersonaPayload = {
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
};
