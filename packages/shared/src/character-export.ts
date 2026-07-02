import type { CharacterImportExampleMessage } from './character-import';

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
  exampleMessages: CharacterImportExampleMessage[];
};
