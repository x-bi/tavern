import type { Character } from '@prisma/client';

import type {
  CharacterExportCard,
  CharacterExportResponse,
  ExampleMessage
} from '../character.types';

type JsonRecord = Record<string, unknown>;

const SENSITIVE_FIELD_PATTERN = /api[_-]?key|secret|token|password|authorization/i;

export class CharacterCardJsonExporter {
  export(
    character: Character,
    metadata: JsonRecord | null,
    exampleMessages: ExampleMessage[]
  ): CharacterExportResponse {
    const exportedAt = new Date().toISOString();
    const importedCard = this.asRecord(metadata?.importedCard);
    const extensions = this.buildExtensions(metadata, importedCard, exportedAt);
    const data = {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMessage,
      mes_example: this.formatExampleMessages(character.name, exampleMessages),
      ...(this.pickString(metadata, 'creatorNotes')
        ? { creator_notes: this.pickString(metadata, 'creatorNotes') }
        : {}),
      ...(this.pickString(metadata, 'systemPrompt')
        ? { system_prompt: this.pickString(metadata, 'systemPrompt') }
        : {}),
      ...(this.pickStringArray(metadata, 'tags').length > 0
        ? { tags: this.pickStringArray(metadata, 'tags') }
        : {}),
      ...(this.pickString(importedCard, 'creator')
        ? { creator: this.pickString(importedCard, 'creator') }
        : {}),
      ...(this.pickString(importedCard, 'characterVersion')
        ? { character_version: this.pickString(importedCard, 'characterVersion') }
        : {}),
      ...(this.pickStringArray(importedCard, 'alternateGreetings').length > 0
        ? { alternate_greetings: this.pickStringArray(importedCard, 'alternateGreetings') }
        : {}),
      ...(Object.keys(extensions).length > 0 ? { extensions } : {})
    };
    const card: CharacterExportCard = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data
    };

    return {
      fileName: `${this.toSafeFileName(character.name)}.json`,
      card,
      exportedAt,
      exampleMessages
    };
  }

  private buildExtensions(
    metadata: JsonRecord | null,
    importedCard: JsonRecord | null,
    exportedAt: string
  ): JsonRecord {
    const importedExtensions = this.asRecord(importedCard?.extensions);
    const extensions: JsonRecord = {
      ...(importedExtensions ? this.sanitizeRecord(importedExtensions) : {})
    };
    const tavernLiteMetadata = this.sanitizeRecord(metadata ?? {});

    if (Object.keys(tavernLiteMetadata).length > 0) {
      extensions.tavernLite = {
        exportedAt,
        metadata: tavernLiteMetadata
      };
    }

    return extensions;
  }

  private formatExampleMessages(characterName: string, exampleMessages: ExampleMessage[]): string {
    if (exampleMessages.length === 0) {
      return '';
    }

    const lines = exampleMessages.map((message) => {
      const speaker = this.toSpeakerLabel(characterName, message.role);

      return `${speaker}: ${message.content}`;
    });

    return `<START>\n${lines.join('\n')}`;
  }

  private toSpeakerLabel(characterName: string, role: ExampleMessage['role']): string {
    if (role === 'user') {
      return '{{user}}';
    }

    if (role === 'assistant') {
      return characterName || '{{char}}';
    }

    return 'system';
  }

  private pickString(record: JsonRecord | null, key: string): string {
    const value = record?.[key];

    return typeof value === 'string' ? value : '';
  }

  private pickStringArray(record: JsonRecord | null, key: string): string[] {
    const value = record?.[key];

    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private sanitizeRecord(record: JsonRecord): JsonRecord {
    return Object.entries(record).reduce<JsonRecord>((result, [key, value]) => {
      if (value === undefined || SENSITIVE_FIELD_PATTERN.test(key)) {
        return result;
      }

      const sanitizedValue = this.sanitizeValue(value);

      if (sanitizedValue !== undefined) {
        result[key] = sanitizedValue;
      }

      return result;
    }, {});
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item)).filter((item) => item !== undefined);
    }

    if (this.asRecord(value)) {
      return this.sanitizeRecord(value as JsonRecord);
    }

    return value;
  }

  private toSafeFileName(name: string): string {
    const normalized = name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80);

    return normalized || 'character-card';
  }

  private asRecord(value: unknown): JsonRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  }
}
