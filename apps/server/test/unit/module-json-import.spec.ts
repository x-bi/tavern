import { describe, expect, it } from 'vitest';

import { parseModuleJson } from '../../src/common/module-json-import';

describe('module JSON V2 format validation', () => {
  const expected = 'tavern-lite.persona.v2';

  it('accepts only an exact V2 formatVersion', () => {
    expect(
      parseModuleJson(JSON.stringify({ formatVersion: expected, name: 'V2' }), expected)
    ).toEqual({ formatVersion: expected, name: 'V2' });
  });

  it.each([
    { formatVersion: 'tavern-lite.persona.v1', name: 'V1' },
    { format: expected, name: 'old field name' },
    { name: 'missing version' }
  ])('rejects obsolete or missing version fields: %j', (input) => {
    expect(() => parseModuleJson(JSON.stringify(input), expected)).toThrow(
      'Unsupported module JSON format version'
    );
  });
});
