export type ExampleMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type CharacterResponse = {
  id: string;
  userId: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: Record<string, unknown> | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CharacterListResponse = {
  items: CharacterResponse[];
  total: number;
  page: number;
  pageSize: number;
};
