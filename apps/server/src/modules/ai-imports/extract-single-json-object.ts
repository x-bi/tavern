import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';

/** 从模型文本中提取唯一根 JSON 对象，正确处理嵌套、字符串和转义。 */
export function extractSingleJsonObject(text: string, maxChars: number): Record<string, unknown> {
  if (!text.trim()) {
    throw error(ERROR_CODES.AI_IMPORT_MODEL_OUTPUT_EMPTY, 'Model output is empty.');
  }
  if (text.length > maxChars) {
    throw error(ERROR_CODES.AI_IMPORT_JSON_INVALID, `Model output exceeds ${maxChars} characters.`);
  }

  const source = stripFence(text);
  let start = -1;
  let end = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (start < 0) {
      if (character === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaping) escaping = false;
      else if (character === '\\') escaping = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
      if (depth < 0) break;
    }
  }

  if (start < 0) {
    throw error(ERROR_CODES.AI_IMPORT_JSON_NOT_FOUND, 'No root JSON object was found.');
  }
  if (end < 0 || inString || depth !== 0) {
    throw error(ERROR_CODES.AI_IMPORT_JSON_INVALID, 'The root JSON object is truncated.');
  }

  const trailing = source.slice(end).trim();
  if (containsRootObject(trailing)) {
    throw error(ERROR_CODES.AI_IMPORT_JSON_INVALID, 'Multiple root JSON objects are not allowed.');
  }

  try {
    const parsed = JSON.parse(source.slice(start, end)) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('Root must be an object.');
    }
    return parsed;
  } catch {
    throw error(ERROR_CODES.AI_IMPORT_JSON_INVALID, 'Model output contains invalid JSON.');
  }
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

function containsRootObject(text: string): boolean {
  let inString = false;
  let escaping = false;
  for (const character of text) {
    if (inString) {
      if (escaping) escaping = false;
      else if (character === '\\') escaping = true;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === '{') return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}
