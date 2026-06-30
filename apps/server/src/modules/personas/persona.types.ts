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

export type PersonaListResponse = {
  items: PersonaResponse[];
  total: number;
  page: number;
  pageSize: number;
};
