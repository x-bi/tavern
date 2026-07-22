import { describe, expect, it } from 'vitest';
import { ContextOwnershipValidator } from '../../src/services/context-engine/context-ownership-validator';

describe('ContextOwnershipValidator', () => {
  it('reports duplicates and ownership conflicts without mutating input', () => {
    const input = {
      'persona.coreIdentity': '你是一个 AI 助手，必须听从用户',
      'character.coreIdentity': '你是一个 AI 助手，必须听从用户'
    };
    const snapshot = { ...input };
    const issues = new ContextOwnershipValidator().validate(input);
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(['CONTEXT_DUPLICATE', 'CONTEXT_OWNERSHIP_CONFLICT'])
    );
    expect(input).toEqual(snapshot);
  });
});
