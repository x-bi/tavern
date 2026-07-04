import type { Character } from '@prisma/client';

import type {
  CharacterExportCard,
  CharacterExportResponse,
  ExampleMessage
} from '../character.types';

type JsonRecord = Record<string, unknown>;

/** 敏感字段名匹配模式：导出时这类字段会被剔除。 */
const SENSITIVE_FIELD_PATTERN = /api[_-]?key|secret|token|password|authorization/i;

/**
 * 角色卡 JSON 导出器：把角色记录转成 chara_card_v2 格式。
 *
 * 设计要点：
 * - 核心字段直接写入；可选字段（creator_notes/system_prompt/tags 等）有值才写入，避免输出空字段；
 * - 扩展字段保留原导入卡片的 extensions，并追加 tavernLite 自己的元数据；
 * - 导出前递归清理敏感字段，防止泄露；
 * - 示例对话格式化为文本（`<START>` + `说话人: 内容`）。
 */
export class CharacterCardJsonExporter {
  /**
   * 导出角色为 chara_card_v2 响应。
   * @param character 角色数据库记录。
   * @param metadata 角色元数据（含可能的原导入卡片快照）。
   * @param exampleMessages 示例对话数组。
   * @returns 含文件名、卡片、导出时间、原始示例对话。
   */
  export(
    character: Character,
    metadata: JsonRecord | null,
    exampleMessages: ExampleMessage[]
  ): CharacterExportResponse {
    const exportedAt = new Date().toISOString();
    // 取原导入卡片的快照（导入时保存在 metadata.importedCard）
    const importedCard = this.asRecord(metadata?.importedCard);
    // 构建扩展字段（含原卡片扩展 + tavernLite 元数据）
    const extensions = this.buildExtensions(metadata, importedCard, exportedAt);
    // 构建 data：核心字段直接写入；以下可选字段有值才写入卡片（避免空字段）
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

  /**
   * 构建扩展字段：保留原卡片的 extensions，并追加 tavernLite 元数据。
   */
  private buildExtensions(
    metadata: JsonRecord | null,
    importedCard: JsonRecord | null,
    exportedAt: string
  ): JsonRecord {
    // 取原卡片的 extensions 并清理敏感字段
    const importedExtensions = this.asRecord(importedCard?.extensions);
    const extensions: JsonRecord = {
      ...(importedExtensions ? this.sanitizeRecord(importedExtensions) : {})
    };
    // tavernLite 自己的元数据（清理敏感字段后）
    const tavernLiteMetadata = this.sanitizeRecord(metadata ?? {});

    // 有内容则挂到 extensions.tavernLite，记录导出时间和元数据
    if (Object.keys(tavernLiteMetadata).length > 0) {
      extensions.tavernLite = {
        exportedAt,
        metadata: tavernLiteMetadata
      };
    }

    return extensions;
  }

  /**
   * 把示例对话格式化为文本：`<START>` 开头，每条 `说话人: 内容`。
   * @returns 格式化文本，无消息返回空串。
   */
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

  /**
   * 角色转说话人标签：
   * - user → `{{user}}` 占位符；
   * - assistant → 角色名（无则 `{{char}}` 占位）；
   * - system → `system`。
   */
  private toSpeakerLabel(characterName: string, role: ExampleMessage['role']): string {
    if (role === 'user') {
      return '{{user}}';
    }

    if (role === 'assistant') {
      return characterName || '{{char}}';
    }

    return 'system';
  }

  /** 从记录取字符串字段；非字符串返回空串。 */
  private pickString(record: JsonRecord | null, key: string): string {
    const value = record?.[key];

    return typeof value === 'string' ? value : '';
  }

  /** 从记录取字符串数组字段；非数组或全非字符串返回空数组。 */
  private pickStringArray(record: JsonRecord | null, key: string): string[] {
    const value = record?.[key];

    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  /**
   * 递归清理记录：剔除 undefined 和敏感字段名，递归清理嵌套值。
   * 用于导出前防止敏感信息泄露。
   */
  private sanitizeRecord(record: JsonRecord): JsonRecord {
    return Object.entries(record).reduce<JsonRecord>((result, [key, value]) => {
      // 跳过 undefined 和疑似敏感字段名
      if (value === undefined || SENSITIVE_FIELD_PATTERN.test(key)) {
        return result;
      }

      const sanitizedValue = this.sanitizeValue(value);

      // 清理后仍有效的才保留
      if (sanitizedValue !== undefined) {
        result[key] = sanitizedValue;
      }

      return result;
    }, {});
  }

  /** 递归清理单个值：数组递归清理每项，对象递归 sanitizeRecord，原始值原样返回。 */
  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item)).filter((item) => item !== undefined);
    }

    if (this.asRecord(value)) {
      return this.sanitizeRecord(value as JsonRecord);
    }

    return value;
  }

  /**
   * 生成安全的导出文件名：替换非法字符为 -、压缩空白、截断 80 字符。
   * @returns 清理后的文件名，空则用默认 `character-card`。
   */
  private toSafeFileName(name: string): string {
    const normalized = name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80);

    return normalized || 'character-card';
  }

  /** 类型守卫：值是否是普通对象（非 null 非数组）。 */
  private asRecord(value: unknown): JsonRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  }
}
