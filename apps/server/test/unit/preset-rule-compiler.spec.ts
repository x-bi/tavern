import { describe, expect, it } from 'vitest';
import { mergePresetOutputRules } from '../../src/services/context-engine/preset-rule-compiler';

describe('preset rule operations', () => {
  it('cannot replace immutable base rules and can disable optional rules', () => {
    const result = mergePresetOutputRules(
      [
        { key: 'safety', content: 'immutable', optional: false, sortOrder: 0 },
        { key: 'brief', content: 'short', optional: true, sortOrder: 1 }
      ],
      [
        { key: 'safety', content: 'bypass', operation: 'replace_optional', sortOrder: 0 },
        { key: 'brief', content: '', operation: 'disable_optional', sortOrder: 1 }
      ]
    );
    expect(result).toEqual([
      { key: 'safety', content: 'immutable', optional: false, sortOrder: 0 }
    ]);
  });
});
