import { describe, expect, it } from 'vitest';

import { normalizeAiImportEnvelope } from '../../src/modules/ai-imports/normalize-ai-import-envelope';

describe('normalizeAiImportEnvelope', () => {
  it('defaults missing decisions and warnings', () => {
    expect(normalizeAiImportEnvelope({ result: { name: 'A' } }, '')).toEqual({
      result: { name: 'A' },
      decisions: [],
      warnings: []
    });
  });

  it('normalizes invalid metadata and corrects previousValue from JSON input', () => {
    const result = normalizeAiImportEnvelope(
      {
        result: { entries: [{ placement: 'before_history' }] },
        decisions: [
          {
            field: 'entries[0].placement',
            value: { unsafe: true },
            previousValue: 'invented',
            basis: 'invalid',
            confidence: 'invalid',
            reason: 'x'.repeat(600)
          }
        ],
        warnings: [{ message: 'warning' }]
      },
      JSON.stringify({ entries: [{ placement: 'instruction' }] })
    );
    expect(result.decisions[0]).toMatchObject({
      value: null,
      previousValue: 'instruction',
      basis: 'inferred',
      confidence: 'low'
    });
    expect(result.decisions[0].reason).toHaveLength(500);
  });

  it('rejects an invalid result envelope', () => {
    expect(() => normalizeAiImportEnvelope({ result: [] }, '')).toThrow(
      'envelope.result must be an object'
    );
  });
});
