import {
  PROMPT_PRESET_GENERATION_PURPOSES,
  PROMPT_PRESET_OUTPUT_RULE_OPERATIONS,
  type PromptPresetGenerationPurpose,
  type PromptPresetOutputRuleOperation
} from './preset-constants';

import {
  assertAllowedFields,
  invalidModuleFormat,
  isRecord,
  type JsonRecord
} from '../../common/module-json-import';
import type { PromptPresetParams } from './prompt-preset.types';

/** instructions 单条最大字符数。 */
const INSTRUCTION_MAX_LENGTH = 2000;
/** instructions 数组最大条数。 */
const INSTRUCTION_MAX_COUNT = 100;
/** outputRuleOperations 数组最大条数。 */
const OUTPUT_RULE_MAX_COUNT = 100;
/** outputRuleOperations.key 最大字符数（与 DTO @MaxLength(120) 对齐）。 */
const RULE_KEY_MAX_LENGTH = 120;
/** outputRuleOperations.content 最大字符数（与 DTO @MaxLength(4000) 对齐）。 */
const RULE_CONTENT_MAX_LENGTH = 4000;
/** generationPurposes 最大条数（当前合法枚举总数）。 */
const GENERATION_PURPOSE_MAX_COUNT = PROMPT_PRESET_GENERATION_PURPOSES.length;

const ALLOWED_PURPOSES = new Set<string>(PROMPT_PRESET_GENERATION_PURPOSES);
const ALLOWED_OPERATIONS = new Set<string>(PROMPT_PRESET_OUTPUT_RULE_OPERATIONS);

/** 预设参数合法字段（camelCase）。 */
const PARAM_FIELDS = [
  'temperature',
  'topP',
  'maxTokens',
  'timeout',
  'frequencyPenalty',
  'presencePenalty'
] as const;

/** 预设参数已废弃的 snake_case 别名 -> 对应 camelCase，用于明确报错。 */
const PARAM_SNAKE_CASE_ALIASES: Record<string, string> = {
  top_p: 'topP',
  max_tokens: 'maxTokens',
  frequency_penalty: 'frequencyPenalty',
  presence_penalty: 'presencePenalty'
};

/**
 * 校验预设 instructions（string[] 口径，见清理方案 §0.1 / §5.7）。
 *
 * 与内容包导入共用同一口径：元素必须为非空字符串，超长直接报错（禁止截断），
 * 类型不正确直接报错（禁止 filter 后继续）。
 */
export function validatePresetInstructions(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw invalidModuleFormat(`${path} must be an array.`);
  }

  if (value.length > INSTRUCTION_MAX_COUNT) {
    throw invalidModuleFormat(`${path} must contain at most ${INSTRUCTION_MAX_COUNT} items.`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw invalidModuleFormat(`${path}[${index}] must be a string.`);
    }

    const trimmed = item.trim();

    if (!trimmed) {
      throw invalidModuleFormat(`${path}[${index}] must be a non-empty string.`);
    }

    if (trimmed.length > INSTRUCTION_MAX_LENGTH) {
      throw invalidModuleFormat(
        `${path}[${index}] must be at most ${INSTRUCTION_MAX_LENGTH} characters.`
      );
    }

    return trimmed;
  });
}

/**
 * 校验预设 outputRuleOperations 嵌套结构（见清理方案 §5.6）。
 *
 * 导入校验路径：非法元素直接报错，禁止 flatMap/filter 静默丢弃。
 * preset-rule-compiler 热路径不调用本函数，仍保持防御性 filter。
 */
export function validatePresetOutputRuleOperations(
  value: unknown,
  path: string
): PromptPresetOutputRuleOperation[] {
  if (!Array.isArray(value)) {
    throw invalidModuleFormat(`${path} must be an array.`);
  }

  if (value.length > OUTPUT_RULE_MAX_COUNT) {
    throw invalidModuleFormat(`${path} must contain at most ${OUTPUT_RULE_MAX_COUNT} items.`);
  }

  const seenKeys = new Set<string>();

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw invalidModuleFormat(`${path}[${index}] must be an object.`);
    }

    assertAllowedFields(item, ['key', 'content', 'operation', 'sortOrder'], `${path}[${index}]`);

    if (typeof item.key !== 'string' || !item.key.trim()) {
      throw invalidModuleFormat(`${path}[${index}].key must be a non-empty string.`);
    }

    const key = item.key.trim();

    if (key.length > RULE_KEY_MAX_LENGTH) {
      throw invalidModuleFormat(
        `${path}[${index}].key must be at most ${RULE_KEY_MAX_LENGTH} characters.`
      );
    }

    if (seenKeys.has(key)) {
      throw invalidModuleFormat(`${path}[${index}].key duplicates rule key: ${key}.`);
    }
    seenKeys.add(key);

    if (typeof item.content !== 'string') {
      throw invalidModuleFormat(`${path}[${index}].content must be a string.`);
    }

    if (item.content.length > RULE_CONTENT_MAX_LENGTH) {
      throw invalidModuleFormat(
        `${path}[${index}].content must be at most ${RULE_CONTENT_MAX_LENGTH} characters.`
      );
    }

    const operation = String(item.operation);

    if (!ALLOWED_OPERATIONS.has(operation)) {
      throw invalidModuleFormat(
        `${path}[${index}].operation must be one of: ${[...ALLOWED_OPERATIONS].join(', ')}.`
      );
    }

    if (
      typeof item.sortOrder !== 'number' ||
      !Number.isInteger(item.sortOrder) ||
      item.sortOrder < 0
    ) {
      throw invalidModuleFormat(`${path}[${index}].sortOrder must be an integer >= 0.`);
    }

    return {
      key,
      content: item.content,
      operation: operation as PromptPresetOutputRuleOperation['operation'],
      sortOrder: item.sortOrder
    };
  });
}

/**
 * 校验预设 generationPurposes（见清理方案 §0.7 / §5.8）。
 *
 * 合法值取自 packages/shared 的 PROMPT_PRESET_GENERATION_PURPOSES，禁止未知值与重复值。
 * 独立导入与内容包导入共用本函数，消除 5-vs-3 分叉。
 */
export function validatePresetGenerationPurposes(
  value: unknown,
  path: string
): PromptPresetGenerationPurpose[] {
  if (!Array.isArray(value)) {
    throw invalidModuleFormat(`${path} must be an array.`);
  }

  if (value.length > GENERATION_PURPOSE_MAX_COUNT) {
    throw invalidModuleFormat(
      `${path} must contain at most ${GENERATION_PURPOSE_MAX_COUNT} items.`
    );
  }

  const seen = new Set<string>();

  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw invalidModuleFormat(`${path}[${index}] must be a string.`);
    }

    if (!ALLOWED_PURPOSES.has(item)) {
      throw invalidModuleFormat(
        `${path}[${index}] has unsupported generation purpose: ${item}. Allowed values: ${[
          ...ALLOWED_PURPOSES
        ].join(', ')}.`
      );
    }

    if (seen.has(item)) {
      throw invalidModuleFormat(`${path}[${index}] duplicates generation purpose: ${item}.`);
    }

    seen.add(item);
    return item as PromptPresetGenerationPurpose;
  });
}

/**
 * 校验预设 parameters（见清理方案 §0.3 / §5.4 / §5.9）。
 *
 * 只接受 camelCase 的 6 个字段；出现 snake_case 别名或未知字段直接报错。
 * 独立导入与内容包导入共用本函数，消除 snake_case 兼容与 frequencyPenalty/presencePenalty 丢失。
 */
export function validatePresetParameters(value: unknown, path: string): PromptPresetParams | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw invalidModuleFormat(`${path} must be an object or null.`);
  }

  for (const [snake, camel] of Object.entries(PARAM_SNAKE_CASE_ALIASES)) {
    if (value[snake] !== undefined) {
      throw invalidModuleFormat(
        `${path}.${snake} is not supported; use ${camel} (camelCase only).`
      );
    }
  }

  for (const field of Object.keys(value)) {
    if (!(PARAM_FIELDS as readonly string[]).includes(field)) {
      throw invalidModuleFormat(`${path}.${field} is not a supported parameter field.`);
    }
  }

  const params: PromptPresetParams = {};
  const record = value as JsonRecord;

  params.temperature = optionalNumberInRange(record.temperature, `${path}.temperature`, 0, 2);
  params.topP = optionalNumberInRange(record.topP, `${path}.topP`, 0, 1);
  params.maxTokens = optionalIntegerInRange(record.maxTokens, `${path}.maxTokens`, 1, 200_000);
  params.timeout = optionalIntegerInRange(record.timeout, `${path}.timeout`, 1_000, 600_000);
  params.frequencyPenalty = optionalNumberInRange(
    record.frequencyPenalty,
    `${path}.frequencyPenalty`,
    -2,
    2
  );
  params.presencePenalty = optionalNumberInRange(
    record.presencePenalty,
    `${path}.presencePenalty`,
    -2,
    2
  );

  for (const field of PARAM_FIELDS) {
    if (params[field] === undefined) {
      delete params[field];
    }
  }

  return Object.keys(params).length > 0 ? params : null;
}

function optionalNumberInRange(
  value: unknown,
  path: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw invalidModuleFormat(`${path} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function optionalIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw invalidModuleFormat(`${path} must be an integer between ${min} and ${max}.`);
  }
  return value as number;
}
