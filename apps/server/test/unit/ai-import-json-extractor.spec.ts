import { describe, expect, it } from 'vitest';

import { extractSingleJsonObject } from '../../src/modules/ai-imports/extract-single-json-object';

describe('extractSingleJsonObject', () => {
  it.each([
    ['pure JSON', '{"result":{"name":"A"}}'],
    ['fenced JSON', '```json\n{"result":{"name":"A"}}\n```'],
    ['surrounding prose', 'Result:\n{"result":{"name":"A"}}\nDone.'],
    ['braces in string', '{"result":{"text":"value { with } braces"}}'],
    ['escaped quotes', '{"result":{"text":"say \\"hello\\""}}'],
    ['nested arrays', '{"result":{"items":[{"value":1},{"value":2}]}}']
  ])('extracts %s', (_name, input) => {
    expect(extractSingleJsonObject(input, 10_000)).toHaveProperty('result');
  });

  it.each([
    ['truncated', '{"result":{"name":"A"}'],
    ['multiple roots', '{"a":1} {"b":2}'],
    ['empty', ''],
    ['no object', 'plain text']
  ])('rejects %s output', (_name, input) => {
    expect(() => extractSingleJsonObject(input, 10_000)).toThrow();
  });

  it('rejects oversized output', () => {
    expect(() => extractSingleJsonObject('{"a":"123"}', 5)).toThrow('exceeds');
  });
});
