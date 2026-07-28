import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { NormalizedAiImportEnvelope } from './ai-import.types';

const BASES = new Set(['source', 'inferred', 'generated', 'default', 'modified']);
const CONFIDENCES = new Set(['high', 'medium', 'low']);

export function normalizeAiImportEnvelope(
  envelope: Record<string, unknown>,
  sourceText: string
): NormalizedAiImportEnvelope {
  if (!isRecord(envelope.result)) {
    throw new BadRequestException({
      code: ERROR_CODES.AI_IMPORT_ENVELOPE_INVALID,
      message: 'AI import envelope.result must be an object.'
    });
  }

  const sourceJson = parseRecord(sourceText);
  const decisions = Array.isArray(envelope.decisions)
    ? envelope.decisions.slice(0, 100).flatMap((item) => {
        if (!isRecord(item) || typeof item.field !== 'string' || !item.field.trim()) return [];
        const value = toScalar(item.value) ?? null;
        const basis =
          typeof item.basis === 'string' && BASES.has(item.basis) ? item.basis : 'inferred';
        const confidence =
          typeof item.confidence === 'string' && CONFIDENCES.has(item.confidence)
            ? item.confidence
            : 'low';
        const previousValue = sourceJson
          ? toScalar(readPath(sourceJson, item.field))
          : toScalar(item.previousValue);
        return [
          {
            field: item.field.trim().slice(0, 300),
            value,
            ...(previousValue !== undefined ? { previousValue } : {}),
            basis: basis as NormalizedAiImportEnvelope['decisions'][number]['basis'],
            confidence: confidence as NormalizedAiImportEnvelope['decisions'][number]['confidence'],
            reason:
              typeof item.reason === 'string'
                ? item.reason.trim().slice(0, 500)
                : 'AI 未提供具体说明。'
          }
        ];
      })
    : [];

  const warnings = Array.isArray(envelope.warnings)
    ? envelope.warnings.slice(0, 50).flatMap((item) =>
        isRecord(item) && typeof item.message === 'string'
          ? [
              {
                code: typeof item.code === 'string' ? item.code.slice(0, 120) : 'AI_IMPORT_WARNING',
                message: item.message.trim().slice(0, 500)
              }
            ]
          : []
      )
    : [];

  return { result: envelope.result, decisions, warnings };
}

function parseRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  const tokens = path.match(/[^.[\]]+/g) ?? [];
  let current: unknown = root;
  for (const token of tokens) {
    if (Array.isArray(current)) current = current[Number(token)];
    else if (isRecord(current)) current = current[token];
    else return undefined;
  }
  return current;
}

function toScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 1000);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
