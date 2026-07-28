import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from '../../../common/dto/error-codes';
import type { ExampleMessage } from '../character.types';
import * as importFormatConstants from '../../../../../../packages/shared/src/import-format.constants.json';

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

/** 严格 chara_card_v2 解析后的结构化字段。 */
export type CharacterImportMappedCard = {
  name: string;
  coreIdentity: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  firstMessage: string;
  exampleMessages: ExampleMessage[];
  metadata: Record<string, unknown>;
  fieldMappings: CharacterImportFieldMapping[];
  warnings: CharacterImportWarning[];
};

type JsonRecord = Record<string, unknown>;

const ROOT_FIELDS = ['spec', 'spec_version', 'data'] as const;
const DATA_FIELDS = [
  'name',
  'coreIdentity',
  'description',
  'personality',
  'persistentPremise',
  'initialScenario',
  'extendedBackground',
  'characterRules',
  'speechStyle',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'tags',
  'creator',
  'character_version',
  'alternate_greetings',
  'extensions',
  'depth_prompt',
  'post_history_instructions'
] as const;
const TEXT_FIELDS = [
  'coreIdentity',
  'description',
  'personality',
  'persistentPremise',
  'initialScenario',
  'extendedBackground',
  'characterRules',
  'speechStyle',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'creator',
  'character_version',
  'post_history_instructions'
] as const;
const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 10_000;

/**
 * 普通角色只接受严格的 `chara_card_v2` 2.0：
 * - 根必须是 `{ spec, spec_version, data }`，不再把根对象当 data；
 * - 不接受旧别名、camel/snake 双写或未知字段；
 * - 标准 V2 字段 `description/scenario/system_prompt` 仍可映射到内部 V2 字段；
 * - 项目 V2 扩展字段使用当前精确字段名，不做任何别名兼容。
 */
export class CharacterCardJsonImporter {
  map(rawJson: string): CharacterImportMappedCard {
    const root = this.requireRecord(this.parseJson(rawJson), 'Character card JSON root');
    this.assertAllowedFields(root, ROOT_FIELDS, 'root');

    if (
      root.spec !== importFormatConstants.characterCardSpec ||
      root.spec_version !== importFormatConstants.characterCardSpecVersion
    ) {
      throw this.invalidFormat('Character import only accepts chara_card_v2 spec_version 2.0.');
    }

    const sensitivePath = this.findSensitiveFieldPath(root);
    if (sensitivePath) {
      throw this.invalidFormat(`Character card contains a sensitive field: ${sensitivePath}.`);
    }

    const data = this.requireRecord(root.data, 'data');
    this.assertAllowedFields(data, DATA_FIELDS, 'data');
    const name = this.requiredText(data.name, 'data.name', MAX_NAME_LENGTH);

    const values = Object.fromEntries(
      TEXT_FIELDS.map((field) => [
        field,
        this.optionalText(data[field], `data.${field}`, MAX_TEXT_LENGTH)
      ])
    ) as Record<(typeof TEXT_FIELDS)[number], string>;
    const exampleMessages = this.parseExampleMessages(values.mes_example, name);
    const metadata = this.readMetadata(data);
    const fieldMappings = this.createFieldMappings(data, values);

    return {
      name,
      coreIdentity: values.coreIdentity || values.description,
      personality: values.personality,
      persistentPremise: values.persistentPremise || values.scenario,
      initialScenario: values.initialScenario || values.scenario,
      extendedBackground: values.extendedBackground,
      characterRules: values.characterRules || values.system_prompt,
      speechStyle: values.speechStyle,
      firstMessage: values.first_mes,
      exampleMessages,
      metadata,
      fieldMappings,
      warnings: []
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

  private readMetadata(data: JsonRecord): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    const creatorNotes = this.optionalText(
      data.creator_notes,
      'data.creator_notes',
      MAX_TEXT_LENGTH
    );
    const creator = this.optionalText(data.creator, 'data.creator', MAX_TEXT_LENGTH);
    const characterVersion = this.optionalText(
      data.character_version,
      'data.character_version',
      MAX_TEXT_LENGTH
    );
    const postHistoryInstructions = this.optionalText(
      data.post_history_instructions,
      'data.post_history_instructions',
      MAX_TEXT_LENGTH
    );

    if (creatorNotes) metadata.creatorNotes = creatorNotes;
    if (creator) metadata.creator = creator;
    if (characterVersion) metadata.characterVersion = characterVersion;
    if (postHistoryInstructions) {
      metadata.postHistoryInstructions = postHistoryInstructions;
    }

    const tags = this.optionalStringArray(data.tags, 'data.tags');
    const alternateGreetings = this.optionalStringArray(
      data.alternate_greetings,
      'data.alternate_greetings'
    );
    if (tags.length) metadata.tags = tags;
    if (alternateGreetings.length) metadata.alternateGreetings = alternateGreetings;

    if (data.extensions !== undefined) {
      metadata.extensions = this.requireRecord(data.extensions, 'data.extensions');
    }
    if (data.depth_prompt !== undefined) {
      metadata.depthPrompt = data.depth_prompt;
    }

    return metadata;
  }

  private createFieldMappings(
    data: JsonRecord,
    values: Record<(typeof TEXT_FIELDS)[number], string>
  ): CharacterImportFieldMapping[] {
    const mappings: CharacterImportFieldMapping[] = [
      { source: 'name', target: 'name', action: 'mapped' }
    ];
    const targets: Partial<Record<(typeof TEXT_FIELDS)[number], string>> = {
      coreIdentity: 'coreIdentity',
      description: values.coreIdentity ? 'chara_card_v2.description' : 'coreIdentity',
      personality: 'personality',
      persistentPremise: 'persistentPremise',
      initialScenario: 'initialScenario',
      extendedBackground: 'extendedBackground',
      characterRules: 'characterRules',
      speechStyle: 'speechStyle',
      scenario:
        values.persistentPremise || values.initialScenario
          ? 'chara_card_v2.scenario'
          : 'persistentPremise/initialScenario',
      first_mes: 'firstMessage',
      mes_example: 'exampleMessages',
      creator_notes: 'metadata.creatorNotes',
      system_prompt: values.characterRules ? 'chara_card_v2.system_prompt' : 'characterRules',
      creator: 'metadata.creator',
      character_version: 'metadata.characterVersion',
      post_history_instructions: 'metadata.postHistoryInstructions'
    };

    for (const field of TEXT_FIELDS) {
      if (data[field] !== undefined) {
        mappings.push({
          source: field,
          target: targets[field] ?? null,
          action: targets[field] ? 'mapped' : 'metadata'
        });
      }
    }
    for (const [source, target] of [
      ['tags', 'metadata.tags'],
      ['alternate_greetings', 'metadata.alternateGreetings'],
      ['extensions', 'metadata.extensions'],
      ['depth_prompt', 'metadata.depthPrompt']
    ] as const) {
      if (data[source] !== undefined) {
        mappings.push({ source, target, action: 'metadata' });
      }
    }
    return mappings;
  }

  private parseExampleMessages(value: string, characterName: string): ExampleMessage[] {
    if (!value) return [];

    const messages: ExampleMessage[] = [];
    let current: ExampleMessage | null = null;

    for (const rawLine of value.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line === '<START>') continue;

      const parsedLine = this.parseExampleLine(line, characterName);
      if (!parsedLine) {
        if (current) current.content = `${current.content}\n${line}`;
        continue;
      }
      if (current) messages.push(current);
      current = parsedLine;
    }
    if (current) messages.push(current);
    return messages;
  }

  private parseExampleLine(line: string, characterName: string): ExampleMessage | null {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 1) return null;

    const speaker = line.slice(0, separatorIndex).trim().toLowerCase();
    const content = line.slice(separatorIndex + 1).trim();
    if (!content) return null;

    if (['{{user}}', '<user>', 'user', 'you'].includes(speaker)) {
      return { role: 'user', content };
    }
    if (
      ['{{char}}', '<char>', 'assistant', 'char'].includes(speaker) ||
      speaker === characterName.trim().toLowerCase()
    ) {
      return { role: 'assistant', content };
    }
    if (speaker === 'system') {
      throw this.invalidFormat('Character example messages only support user and assistant roles.');
    }
    return null;
  }

  private requiredText(value: unknown, path: string, maxLength: number): string {
    const text = this.optionalText(value, path, maxLength);
    if (!text) throw this.invalidFormat(`${path} must be a non-empty string.`);
    return text;
  }

  private optionalText(value: unknown, path: string, maxLength: number): string {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string when present.`);
    }
    const text = value.trim();
    if (text.length > maxLength) {
      throw this.invalidFormat(`${path} must be at most ${maxLength} characters.`);
    }
    return text;
  }

  private optionalStringArray(value: unknown, path: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw this.invalidFormat(`${path} must be a string array.`);
    return value.map((item, index) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw this.invalidFormat(`${path}[${index}] must be a non-empty string.`);
      }
      return item.trim();
    });
  }

  private requireRecord(value: unknown, path: string): JsonRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw this.invalidFormat(`${path} must be an object.`);
    }
    return value as JsonRecord;
  }

  private assertAllowedFields(
    record: JsonRecord,
    allowedFields: readonly string[],
    path: string
  ): void {
    const allowed = new Set(allowedFields);
    const unknown = Object.keys(record).find((field) => !allowed.has(field));
    if (unknown) {
      throw this.invalidFormat(`${path}.${unknown} is not supported by chara_card_v2.`);
    }
  }

  private findSensitiveFieldPath(value: unknown, path = '$'): string | null {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = this.findSensitiveFieldPath(value[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    if (typeof value !== 'object' || value === null) return null;

    for (const [field, child] of Object.entries(value as JsonRecord)) {
      const childPath = `${path}.${field}`;
      if (/api[_-]?key|secret|token|password|authorization/i.test(field)) {
        return childPath;
      }
      const found = this.findSensitiveFieldPath(child, childPath);
      if (found) return found;
    }
    return null;
  }

  private invalidFormat(message: string): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
      message
    });
  }
}
