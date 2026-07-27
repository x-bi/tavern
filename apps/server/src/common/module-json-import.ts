import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from './dto/error-codes';

/** 单模块 JSON 导入告警。 */
export type ModuleJsonImportWarning = {
  code: string;
  message: string;
  field?: string;
};

/** JSON 对象类型。 */
export type JsonRecord = Record<string, unknown>;

/** 解析单模块导入 JSON，并做根对象、formatVersion、敏感字段校验。 */
export function parseModuleJson(rawJson: string, expectedFormat: string): JsonRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new BadRequestException({
      code: ERROR_CODES.MODULE_IMPORT_INVALID_JSON,
      message: 'Module JSON could not be parsed.'
    });
  }

  if (!isRecord(parsed)) {
    throw invalidModuleFormat('Module JSON root must be an object.');
  }

  const sensitivePath = findSensitiveFieldPath(parsed);

  if (sensitivePath) {
    throw new BadRequestException({
      code: ERROR_CODES.MODULE_IMPORT_SENSITIVE_FIELD,
      message: `Module JSON contains a sensitive field: ${sensitivePath}.`,
      details: {
        field: sensitivePath
      }
    });
  }

  if (parsed.formatVersion !== expectedFormat) {
    throw invalidModuleFormat(
      `Unsupported module JSON format version: ${String(parsed.formatVersion ?? 'missing')}.`
    );
  }

  return parsed;
}

/** 构造模块导入格式错误。 */
export function invalidModuleFormat(message: string): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.MODULE_IMPORT_INVALID_FORMAT,
    message
  });
}

/** 拒绝 V2 对象中的未知字段，避免旧字段或拼写错误被静默忽略。 */
export function assertAllowedFields(
  record: JsonRecord,
  allowedFields: readonly string[],
  path: string
): void {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(record).find((field) => !allowed.has(field));

  if (unknown) {
    throw invalidModuleFormat(`${path}.${unknown} is not supported by the V2 format.`);
  }
}

/** 读取必填字符串字段。 */
export function requiredString(record: JsonRecord, field: string, path: string): string {
  const value = record[field];

  if (typeof value !== 'string' || !value.trim()) {
    throw invalidModuleFormat(`${path} must be a non-empty string.`);
  }

  return value.trim();
}

/** 读取可选字符串字段。 */
export function optionalString(record: JsonRecord, field: string, path: string): string | null {
  const value = record[field];

  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidModuleFormat(`${path} must be a string or null.`);
  }

  return value.trim() || null;
}

/** 读取可选对象字段。 */
export function optionalRecord(record: JsonRecord, field: string, path: string): JsonRecord | null {
  const value = record[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw invalidModuleFormat(`${path} must be an object or null.`);
  }

  return value;
}

/** 读取可选布尔字段。 */
export function optionalBoolean(
  record: JsonRecord,
  field: string,
  defaultValue: boolean,
  path: string
): boolean {
  const value = record[field];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== 'boolean') {
    throw invalidModuleFormat(`${path} must be a boolean when present.`);
  }

  return value;
}

/** 读取可选整数字段。 */
export function optionalInteger(
  record: JsonRecord,
  field: string,
  defaultValue: number,
  path: string
): number {
  const value = record[field];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (!Number.isInteger(value)) {
    throw invalidModuleFormat(`${path} must be an integer when present.`);
  }

  return value as number;
}

/** 读取可选可空整数字段。 */
export function optionalNullableInteger(
  record: JsonRecord,
  field: string,
  path: string
): number | null {
  const value = record[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    throw invalidModuleFormat(`${path} must be an integer or null.`);
  }

  return value as number;
}

/** 读取必填字符串数组字段。 */
export function requiredStringArray(record: JsonRecord, field: string, path: string): string[] {
  const value = record[field];

  if (!Array.isArray(value)) {
    throw invalidModuleFormat(`${path} must be a string array.`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw invalidModuleFormat(`${path}[${index}] must be a non-empty string.`);
    }

    return item.trim();
  });
}

/** 读取可选字符串数组字段。 */
export function optionalStringArray(record: JsonRecord, field: string, path: string): string[] {
  const value = record[field];

  if (value === undefined || value === null) {
    return [];
  }

  return requiredStringArray(record, field, path);
}

/** 限制文本长度，超长时截断并记录告警。 */
export function limitText(
  value: string,
  maxLength: number,
  field: string,
  warnings: ModuleJsonImportWarning[]
): string {
  if (value.length <= maxLength) {
    return value;
  }

  warnings.push({
    code: 'FIELD_TRUNCATED',
    field,
    message: `${field} 超过 ${maxLength} 个字符，已截断。`
  });

  return value.slice(0, maxLength);
}

/** 为同名资源生成可用名称。 */
export function createAvailableName(baseName: string, usedNames: Set<string>): string {
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName} (${index})`;

    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `${baseName} (${Date.now()})`;
}

/** 判断值是否为普通对象。 */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findSensitiveFieldPath(value: unknown, path = '$'): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitiveFieldPath(value[index], `${path}[${index}]`);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (isSensitiveFieldName(key)) {
      return childPath;
    }

    const found = findSensitiveFieldPath(child, childPath);

    if (found) {
      return found;
    }
  }

  return null;
}

function isSensitiveFieldName(field: string): boolean {
  return /api[_-]?key|secret|password|authorization|access[_-]?token|refresh[_-]?token|bearer/i.test(
    field
  );
}
