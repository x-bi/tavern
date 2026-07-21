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

/** importer 解析后的中间结果：映射好的结构化字段 + 字段映射记录 + 警告。 */
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

/**
 * 各业务字段的候选源字段名（兼容不同卡片实现）。
 * 按数组顺序匹配，先命中先用。
 */
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

/** metadata 类字段：源字段名 → 归档到 importedCard 的目标字段名（camelCase）。 */
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

/** 直接忽略的字段：头像/时间戳类，JSON 导入不处理。 */
const IGNORED_FIELDS = new Set(['avatar', 'avatar_file_name', 'create_date', 'modification_date']);
/** 名称最大长度。 */
const MAX_NAME_LENGTH = 120;
/** 文本字段最大长度（超长截断并告警）。 */
const MAX_TEXT_LENGTH = 10000;

/**
 * 角色卡 JSON 导入器：把 chara_card_v2 等 JSON 解析成结构化字段。
 *
 * 设计要点：
 * - 兼容多种字段命名（first_mes / firstMessage / first_message / greeting 等）；
 * - 示例对话支持数组格式和文本格式两种；
 * - 疑似敏感字段（含 api_key/secret/token/password）一律忽略并告警；
 * - 超长字段截断并告警；
 * - 记录每个字段的来源和去向（fieldMappings），便于前端展示。
 */
export class CharacterCardJsonImporter {
  /**
   * 解析原始 JSON，映射成结构化字段。
   * @param rawJson 原始 JSON 文本。
   * @returns 映射后的中间结果。
   * @throws BadRequestException JSON 非法 / 根非对象 / 缺少可用 name 字段。
   */
  map(rawJson: string): CharacterImportMappedCard {
    // 解析 JSON，非法直接报错
    const parsed = this.parseJson(rawJson);
    const root = this.asRecord(parsed);
    const fieldMappings: CharacterImportFieldMapping[] = [];
    const warnings: CharacterImportWarning[] = [];

    // 根必须是对象
    if (!root) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
        message: 'Character card JSON must be an object.'
      });
    }

    // 兼容 v2 规范：优先取 data 字段，没有则把 root 当作 card
    const card = this.asRecord(root.data) ?? root;

    // name 是必填字段，从候选字段名中取，取不到则格式错误
    const nameSource = this.pickString(card, root, FIELD_CANDIDATES.name);

    if (!nameSource.value) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
        message: 'Character card JSON is missing a usable name field.'
      });
    }

    // 提取各文本字段（每个都做长度截断，超长会写入 warnings）
    const description = this.pickText(card, root, FIELD_CANDIDATES.description, warnings);
    const personality = this.pickText(card, root, FIELD_CANDIDATES.personality, warnings);
    const scenario = this.pickText(card, root, FIELD_CANDIDATES.scenario, warnings);
    const firstMessage = this.pickText(card, root, FIELD_CANDIDATES.firstMessage, warnings);
    const systemPrompt = this.pickText(card, root, FIELD_CANDIDATES.systemPrompt, warnings);
    const creatorNotes = this.pickText(card, root, FIELD_CANDIDATES.creatorNotes, warnings);
    // 示例对话支持数组或文本两种格式，单独解析
    const exampleSource = this.pickUnknown(card, root, FIELD_CANDIDATES.exampleMessages);
    const exampleMessages = this.parseExampleMessages(
      exampleSource.value,
      nameSource.value,
      warnings
    );
    // 构建 metadata（含 systemPrompt/creatorNotes、原卡片扩展字段、未映射字段）
    const metadata = this.buildMetadata(
      root,
      card,
      systemPrompt.value,
      creatorNotes.value,
      warnings
    );

    // 记录已映射到业务字段的映射关系
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
    // 记录 metadata 类和 ignored 类字段的映射
    this.addMetadataAndIgnoredFields(root, card, fieldMappings, warnings);

    return {
      // name 单独做长度限制（其余文本字段在 pickText 内已截断）
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

  /** 解析 JSON 文本，失败抛 CHARACTER_IMPORT_INVALID_JSON。 */
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

  /**
   * 构建 metadata：把 systemPrompt/creatorNotes、已知扩展字段、未映射字段归档。
   *
   * 产出两部分：
   * - metadata 顶层：systemPrompt / creatorNotes / tags / importedCard；
   * - importedCard：原卡片信息的快照（含未映射字段），供导出时回写。
   */
  private buildMetadata(
    root: JsonRecord,
    card: JsonRecord,
    systemPrompt: string,
    creatorNotes: string,
    warnings: CharacterImportWarning[]
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    // 原始卡片信息快照，记录导入时间和格式
    const importedCard: Record<string, unknown> = {
      importedAt: new Date().toISOString(),
      format: 'tavern-json'
    };
    // 未能映射到已知字段的额外字段
    const unmappedFields: Record<string, unknown> = {};

    // systemPrompt / creatorNotes 提到 metadata 顶层（便于业务直接取用）
    if (systemPrompt) {
      metadata.systemPrompt = systemPrompt;
    }

    if (creatorNotes) {
      metadata.creatorNotes = creatorNotes;
    }

    // 遍历已知的 metadata 类字段，分别归档
    for (const [sourceField, targetField] of Object.entries(METADATA_FIELDS)) {
      const value = this.getSourceValue(root, card, sourceField);

      if (value === undefined) {
        continue;
      }

      if (sourceField === 'tags') {
        // tags 单独解析成数组放 metadata 顶层
        const tags = this.parseTags(value);

        if (tags.length > 0) {
          metadata.tags = tags;
        }
      } else if (!this.isSensitiveFieldName(sourceField)) {
        // 非敏感字段存入 importedCard 快照
        importedCard[targetField] = value;
      }
    }

    // 遍历 card 中非已知、非忽略、非敏感的字段 → unmappedFields
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

    // 有未映射字段则挂到 importedCard
    if (Object.keys(unmappedFields).length > 0) {
      importedCard.unmappedFields = unmappedFields;
    }

    // importedCard 有实质内容（除 importedAt/format 两个固定字段外）才挂到 metadata
    if (Object.keys(importedCard).length > 2) {
      metadata.importedCard = importedCard;
    }

    // 敏感字段统一告警（提示用户被忽略）
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

  /**
   * 解析示例对话，支持两种格式：
   * - 数组格式：`[{ role, content }]` 或 `[{ role, text }]`；
   * - 文本格式：`<START>` 分段，`说话人: 内容` 每行一条。
   */
  private parseExampleMessages(
    value: unknown,
    characterName: string,
    warnings: CharacterImportWarning[]
  ): ExampleMessage[] {
    // 空值 → 空数组
    if (value === undefined || value === null || value === '') {
      return [];
    }

    // 数组格式：逐项提取 role/content（content 也兼容 text 字段名）
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

        if (role && !this.isExampleRole(role)) {
          throw new BadRequestException({
            code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
            message: 'Character example messages only support user and assistant roles.'
          });
        }

        // role 必须合法且内容非空才保留
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

    // 非字符串非数组：格式不支持，告警并忽略
    if (typeof value !== 'string') {
      warnings.push({
        code: 'EXAMPLE_MESSAGES_UNSUPPORTED',
        field: 'mes_example',
        message: '示例对话格式不是字符串或消息数组，已忽略。'
      });
      return [];
    }

    // 文本格式：按行解析，以说话人行为分隔
    const messages: ExampleMessage[] = [];
    let current: ExampleMessage | null = null;

    for (const rawLine of value.split(/\r?\n/)) {
      const line = rawLine.trim();

      // 空行或 <START> 分隔符跳过
      if (!line || line === '<START>') {
        continue;
      }

      const parsedLine = this.parseExampleLine(line, characterName);

      if (!parsedLine) {
        // 不是说话人行：追加到当前消息内容（多行内容）
        if (current) {
          current.content = `${current.content}\n${line}`;
        }
        continue;
      }

      // 新说话人：把上一条存入列表，开始新的一条
      if (current) {
        messages.push(current);
      }

      current = parsedLine;
    }

    // 最后一条
    if (current) {
      messages.push(current);
    }

    return messages.map((message) => ({
      role: message.role,
      content: this.limitText(message.content, MAX_TEXT_LENGTH, 'mes_example', warnings)
    }));
  }

  /**
   * 解析单行对话：`说话人: 内容` → ExampleMessage。
   *
   * 说话人识别规则（大小写不敏感）：
   * - user 变体（{{user}}/<user>/user/you）→ user；
   * - assistant 变体（{{char}}/<char>/assistant/char）或与角色同名 → assistant；
   * - 其余无法识别 → null（视为上一条的多行内容）。
   */
  private parseExampleLine(line: string, characterName: string): ExampleMessage | null {
    // 按 ":" 拆分说话人和内容
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

    // user 变体
    if (['{{user}}', '<user>', 'user', 'you'].includes(normalizedSpeaker)) {
      return { role: 'user', content };
    }

    // assistant 变体或与角色同名
    if (
      ['{{char}}', '<char>', 'assistant', 'char'].includes(normalizedSpeaker) ||
      normalizedSpeaker === normalizedCharacterName
    ) {
      return { role: 'assistant', content };
    }

    if (normalizedSpeaker === 'system') {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT,
        message: 'Character example messages only support user and assistant roles.'
      });
    }

    return null;
  }

  /** 提取文本字段：取值 + 长度截断。 */
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

  /** 提取字符串字段：取值并 trim。 */
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

  /**
   * 按候选字段名顺序查找：先查 card，再查 root，命中即返回。
   * @returns `{ source, value }`，未命中 source 为 null、value 为 undefined。
   */
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

  /** 取字段值：优先 card，其次 root。 */
  private getSourceValue(root: JsonRecord, card: JsonRecord, field: string): unknown {
    return card[field] ?? root[field];
  }

  /**
   * 长度截断：超长则截断并写入 FIELD_TRUNCATED 警告。
   * @returns 不超长返回原值，超长返回截断后的值。
   */
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

  /** 解析 tags：数组取字符串项，字符串按逗号分隔。 */
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

  /** 记录已映射到业务字段的映射关系（source 非空才记）。 */
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

  /**
   * 遍历 card 字段，分三类记录映射：
   * - metadata 类（在 METADATA_FIELDS 中）→ 归档到 importedCard；
   * - ignored 类（在 IGNORED_FIELDS 中）→ 忽略并告警；
   * - 未映射类（非已知非敏感）→ 归档到 unmappedFields。
   */
  private addMetadataAndIgnoredFields(
    root: JsonRecord,
    card: JsonRecord,
    mappings: CharacterImportFieldMapping[],
    warnings: CharacterImportWarning[]
  ) {
    for (const field of Object.keys(card)) {
      if (Object.prototype.hasOwnProperty.call(METADATA_FIELDS, field)) {
        // metadata 类
        mappings.push({
          source: field,
          target:
            field === 'tags' ? 'metadata.tags' : `metadata.importedCard.${METADATA_FIELDS[field]}`,
          action: 'metadata'
        });
      } else if (IGNORED_FIELDS.has(field)) {
        // ignored 类：头像/时间戳等不处理
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
        // 未映射类：额外字段归档到 unmappedFields
        mappings.push({
          source: field,
          target: `metadata.importedCard.unmappedFields.${field}`,
          action: 'metadata'
        });
      }
    }

    // spec / spec_version 可能在 root 层（v2 卡片外层），card 没有时也从 root 记录
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

  /** 判断字段是否是已知的业务字段（在 FIELD_CANDIDATES 任一候选中）。 */
  private isKnownField(field: string): boolean {
    return Object.values(FIELD_CANDIDATES).some((fields) =>
      (fields as readonly string[]).includes(field)
    );
  }

  /** 判断字段名是否疑似敏感信息（含 api_key/secret/token/password/authorization）。 */
  private isSensitiveFieldName(field: string): boolean {
    return /api[_-]?key|secret|token|password|authorization/i.test(field);
  }

  /** 类型守卫：role 是否是合法的 ExampleMessage 角色。 */
  private isExampleRole(role: string): role is ExampleMessage['role'] {
    return ['user', 'assistant'].includes(role);
  }

  /** 类型守卫：值是否是普通对象（非 null 非数组）。 */
  private asRecord(value: unknown): JsonRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  }
}
