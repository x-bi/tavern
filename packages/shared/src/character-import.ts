export type CharacterImportDuplicateNameStrategy = 'reject' | 'rename';

export type CharacterImportExampleMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type CharacterImportPayload = {
  rawJson: string;
  commit?: boolean;
  duplicateNameStrategy?: CharacterImportDuplicateNameStrategy;
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
  exampleMessages: CharacterImportExampleMessage[];
  metadata: Record<string, unknown>;
  fieldMappings: CharacterImportFieldMapping[];
  warnings: CharacterImportWarning[];
  nameConflict: boolean;
  suggestedName: string | null;
};

export type CharacterImportResponse<TCharacter = unknown> = {
  imported: boolean;
  preview: CharacterImportPreview;
  character: TCharacter | null;
};
