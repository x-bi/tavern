export type ExampleMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type CharacterMetadata = Record<string, unknown> & {
  tags?: string[];
  systemPrompt?: string;
  creatorNotes?: string;
};

export type CharacterEditorForm = {
  avatarAssetId: string | null;
  avatarUrl: string;
  name: string;
  tagsText: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  systemPrompt: string;
  exampleMessagesText: string;
};

export type CharacterMutationPayload = {
  avatarAssetId?: string | null;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: CharacterMetadata;
};
