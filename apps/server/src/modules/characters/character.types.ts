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

export type CharacterImportFieldAction = 'mapped' | 'metadata' | 'ignored';

export type CharacterImportFieldMapping = {
  source: string;
  target: string | null;
  action: CharacterImportFieldAction;
  note?: string;
};

export type CharacterImportWarning = {
  code: string;
  message: string;
  field?: string;
};

export type CharacterImportPreview = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: Record<string, unknown>;
  fieldMappings: CharacterImportFieldMapping[];
  warnings: CharacterImportWarning[];
  nameConflict: boolean;
  suggestedName: string | null;
};

export type CharacterImportResponse = {
  imported: boolean;
  preview: CharacterImportPreview;
  character: CharacterResponse | null;
};

export type CharacterExportCardData = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string;
  system_prompt?: string;
  tags?: string[];
  creator?: string;
  character_version?: string;
  alternate_greetings?: string[];
  extensions?: Record<string, unknown>;
};

export type CharacterExportCard = {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CharacterExportCardData;
};

export type CharacterExportResponse = {
  fileName: string;
  card: CharacterExportCard;
  exportedAt: string;
  exampleMessages: ExampleMessage[];
};
