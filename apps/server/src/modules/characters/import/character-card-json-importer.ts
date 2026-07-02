import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from '../../../common/dto/error-codes';
import type { ExampleMessage } from '../character.types';

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

export type CharacterImportMappedCard = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: Record<string, unknown>;
  fieldMappings: CharacterImportFieldMapping[];
  warnings: CharacterImportWarning[];
};

type JsonRecord = Record<string, unknown>;

const FIELD_CANDIDATES = {
  name: ['name', 'char_name', 'character_name'],
  description: ['description', 'desc'],
  personality: ['personality'],
  scenario: ['scenario'],
  firstMessage: ['first_mes', 'firstMessage', 'first_message', 'greeting'],
  exampleMessages: ['mes_example', 'exampleMessages', 'example_messages'],
  systemPrompt: ['system_prompt', 'systemPrompt'],
  creatorNotes: ['creator_notes', 'creatorNotes']
} as const;

const METADATA_FIELDS: Record<string, string> = {
  alternate_greetings: 'alternateGreetings',
  character_version: 'characterVersion',
  creator: 'creator',
  depth_prompt: 'depthPrompt',
  extensions: 'extensions',
  post_history_instructions: 'postHistoryInstructions',
  spec: 'spec',
  spec_version: 'specVersion',
  tags: 'tags'
};

const IGNORED_FIELDS = new Set(['avatar', 'avatar_file_name', 'create_date', 'modification_date']);
const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 10000;

export class CharacterCardJsonImporter {
  map(rawJson: string): CharacterImportMappedCard {
    const parsed = this.parseJson(rawJson);
    const root = this.asRecord(parsed);
    const fieldMappings: CharacterImportFieldMapping[] = [];
    const warnings: CharacterImportWarning[] = [];

    if (!root) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
        message: 'Character card JSON must be an object.'
      });
    }

    const card = this.asRecord(root.data) ?? root;

    const nameSource = this.pickString(card, root, FIELD_CANDIDATES.name);

    if (!nameSource.value) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
        message: 'Character card JSON is missing a usable name field.'
      });
    }

    const description = this.pickText(card, root, FIELD_CANDIDATES.description, warnings);
    const personality = this.pickText(card, root, FIELD_CANDIDATES.personality, warnings);
    const scenario = this.pickText(card, root, FIELD_CANDIDATES.scenario, warnings);
    const firstMessage = this.pickText(card, root, FIELD_CANDIDATES.firstMessage, warnings);
    const systemPrompt = this.pickText(card, root, FIELD_CANDIDATES.systemPrompt, warnings);
    const creatorNotes = this.pickText(card, root, FIELD_CANDIDATES.creatorNotes, warnings);
    const exampleSource = this.pickUnknown(card, root, FIELD_CANDIDATES.exampleMessages);
    const exampleMessages = this.parseExampleMessages(
      exampleSource.value,
      nameSource.value,
      warnings
    );
    const metadata = this.buildMetadata(
      root,
      card,
      systemPrompt.value,
      creatorNotes.value,
      warnings
    );

    this.addMappedFields(fieldMappings, [
      [nameSource.source, 'name'],
      [description.source, 'description'],
      [personality.source, 'personality'],
      [scenario.source, 'scenario'],
      [firstMessage.source, 'firstMessage'],
      [exampleSource.source, 'exampleMessages'],
      [systemPrompt.source, 'metadata.systemPrompt'],
      [creatorNotes.source, 'metadata.creatorNotes']
    ]);
    this.addMetadataAndIgnoredFields(root, card, fieldMappings, warnings);

    return {
      name: this.limitText(nameSource.value, MAX_NAME_LENGTH, 'name', warnings),
      description: description.value,
      personality: personality.value,
      scenario: scenario.value,
      firstMessage: firstMessage.value,
      exampleMessages,
      metadata,
      fieldMappings,
      warnings
    };
  }

  private parseJson(rawJson: string): unknown {
    try {
      return JSON.parse(rawJson) as unknown;
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_JSON,
        message: 'Character card JSON could not be parsed.'
      });
    }
  }

  private buildMetadata(
    root: JsonRecord,
    card: JsonRecord,
    systemPrompt: string,
    creatorNotes: string,
    warnings: CharacterImportWarning[]
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    const importedCard: Record<string, unknown> = {
      importedAt: new Date().toISOString(),
      format: 'tavern-json'
    };
    const unmappedFields: Record<string, unknown> = {};

    if (systemPrompt) {
      metadata.systemPrompt = systemPrompt;
    }

    if (creatorNotes) {
      metadata.creatorNotes = creatorNotes;
    }

    for (const [sourceField, targetField] of Object.entries(METADATA_FIELDS)) {
      const value = this.getSourceValue(root, card, sourceField);

      if (value === undefined) {
        continue;
      }

      if (sourceField === 'tags') {
        const tags = this.parseTags(value);

        if (tags.length > 0) {
          metadata.tags = tags;
        }
      } else if (!this.isSensitiveFieldName(sourceField)) {
        importedCard[targetField] = value;
      }
    }

    for (const [field, value] of Object.entries(card)) {
      if (
        this.isKnownField(field) ||
        IGNORED_FIELDS.has(field) ||
        value === undefined ||
        this.isSensitiveFieldName(field)
      ) {
        continue;
      }

      unmappedFields[field] = value;
    }

    if (Object.keys(unmappedFields).length > 0) {
      importedCard.unmappedFields = unmappedFields;
    }

    if (Object.keys(importedCard).length > 2) {
      metadata.importedCard = importedCard;
    }

    for (const field of Object.keys(card)) {
      if (this.isSensitiveFieldName(field)) {
        warnings.push({
          code: 'SENSITIVE_FIELD_IGNORED',
          field,
          message: `字段 ${field} 疑似敏感信息，已忽略。`
        });
      }
    }

    return metadata;
  }

  private parseExampleMessages(
    value: unknown,
    characterName: string,
    warnings: CharacterImportWarning[]
  ): ExampleMessage[] {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        const record = this.asRecord(item);
        const role = typeof record?.role === 'string' ? record.role : '';
        const content =
          typeof record?.content === 'string'
            ? record.content
            : typeof record?.text === 'string'
              ? record.text
              : '';

        return this.isExampleRole(role) && content.trim()
          ? [
              {
                role,
                content: this.limitText(content.trim(), MAX_TEXT_LENGTH, 'mes_example', warnings)
              }
            ]
          : [];
      });
    }

    if (typeof value !== 'string') {
      warnings.push({
        code: 'EXAMPLE_MESSAGES_UNSUPPORTED',
        field: 'mes_example',
        message: '示例对话格式不是字符串或消息数组，已忽略。'
      });
      return [];
    }

    const messages: ExampleMessage[] = [];
    let current: ExampleMessage | null = null;

    for (const rawLine of value.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line === '<START>') {
        continue;
      }

      const parsedLine = this.parseExampleLine(line, characterName);

      if (!parsedLine) {
        if (current) {
          current.content = `${current.content}\n${line}`;
        }
        continue;
      }

      if (current) {
        messages.push(current);
      }

      current = parsedLine;
    }

    if (current) {
      messages.push(current);
    }

    return messages.map((message) => ({
      role: message.role,
      content: this.limitText(message.content, MAX_TEXT_LENGTH, 'mes_example', warnings)
    }));
  }

  private parseExampleLine(line: string, characterName: string): ExampleMessage | null {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex < 1) {
      return null;
    }

    const speaker = line.slice(0, separatorIndex).trim();
    const content = line.slice(separatorIndex + 1).trim();

    if (!content) {
      return null;
    }

    const normalizedSpeaker = speaker.toLowerCase();
    const normalizedCharacterName = characterName.trim().toLowerCase();

    if (['{{user}}', '<user>', 'user', 'you'].includes(normalizedSpeaker)) {
      return { role: 'user', content };
    }

    if (
      ['{{char}}', '<char>', 'assistant', 'char'].includes(normalizedSpeaker) ||
      normalizedSpeaker === normalizedCharacterName
    ) {
      return { role: 'assistant', content };
    }

    if (normalizedSpeaker === 'system') {
      return { role: 'system', content };
    }

    return null;
  }

  private pickText(
    card: JsonRecord,
    root: JsonRecord,
    fields: readonly string[],
    warnings: CharacterImportWarning[]
  ): { source: string | null; value: string } {
    const picked = this.pickString(card, root, fields);

    return {
      source: picked.source,
      value: picked.value
        ? this.limitText(picked.value, MAX_TEXT_LENGTH, picked.source ?? fields[0], warnings)
        : ''
    };
  }

  private pickString(
    card: JsonRecord,
    root: JsonRecord,
    fields: readonly string[]
  ): { source: string | null; value: string } {
    const picked = this.pickUnknown(card, root, fields);

    return {
      source: picked.source,
      value: typeof picked.value === 'string' ? picked.value.trim() : ''
    };
  }

  private pickUnknown(
    card: JsonRecord,
    root: JsonRecord,
    fields: readonly string[]
  ): { source: string | null; value: unknown } {
    for (const field of fields) {
      if (card[field] !== undefined) {
        return { source: field, value: card[field] };
      }

      if (root[field] !== undefined) {
        return { source: field, value: root[field] };
      }
    }

    return { source: null, value: undefined };
  }

  private getSourceValue(root: JsonRecord, card: JsonRecord, field: string): unknown {
    return card[field] ?? root[field];
  }

  private limitText(
    value: string,
    maxLength: number,
    field: string,
    warnings: CharacterImportWarning[]
  ): string {
    if (value.length <= maxLength) {
      return value;
    }

    warnings.push({
      code: 'FIELD_TRUNCATED',
      field,
      message: `字段 ${field} 超过 ${maxLength} 个字符，已截断。`
    });

    return value.slice(0, maxLength);
  }

  private parseTags(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    return typeof value === 'string'
      ? value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
  }

  private addMappedFields(
    mappings: CharacterImportFieldMapping[],
    fields: Array<[string | null, string]>
  ) {
    for (const [source, target] of fields) {
      if (!source) {
        continue;
      }

      mappings.push({
        source,
        target,
        action: 'mapped'
      });
    }
  }

  private addMetadataAndIgnoredFields(
    root: JsonRecord,
    card: JsonRecord,
    mappings: CharacterImportFieldMapping[],
    warnings: CharacterImportWarning[]
  ) {
    for (const field of Object.keys(card)) {
      if (Object.prototype.hasOwnProperty.call(METADATA_FIELDS, field)) {
        mappings.push({
          source: field,
          target:
            field === 'tags' ? 'metadata.tags' : `metadata.importedCard.${METADATA_FIELDS[field]}`,
          action: 'metadata'
        });
      } else if (IGNORED_FIELDS.has(field)) {
        mappings.push({
          source: field,
          target: null,
          action: 'ignored',
          note: 'JSON 导入阶段不处理头像或时间戳字段。'
        });
        warnings.push({
          code: 'FIELD_IGNORED',
          field,
          message: `字段 ${field} 不在 JSON 角色卡导入范围内，已忽略。`
        });
      } else if (!this.isKnownField(field) && !this.isSensitiveFieldName(field)) {
        mappings.push({
          source: field,
          target: `metadata.importedCard.unmappedFields.${field}`,
          action: 'metadata'
        });
      }
    }

    for (const field of ['spec', 'spec_version']) {
      if (root[field] !== undefined && card[field] === undefined) {
        mappings.push({
          source: field,
          target: `metadata.importedCard.${METADATA_FIELDS[field]}`,
          action: 'metadata'
        });
      }
    }
  }

  private isKnownField(field: string): boolean {
    return Object.values(FIELD_CANDIDATES).some((fields) =>
      (fields as readonly string[]).includes(field)
    );
  }

  private isSensitiveFieldName(field: string): boolean {
    return /api[_-]?key|secret|token|password|authorization/i.test(field);
  }

  private isExampleRole(role: string): role is ExampleMessage['role'] {
    return ['user', 'assistant', 'system'].includes(role);
  }

  private asRecord(value: unknown): JsonRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  }
}
