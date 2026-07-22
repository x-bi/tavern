import { describe, expect, it } from 'vitest';
import type {
  PromptCapabilities,
  PromptSectionV2
} from '../../src/services/context-engine/prompt-section.types';
import { canonicalSha256 } from '../../src/common/canonical-json';
import { compilePromptSections } from '../../src/services/context-engine/provider-prompt-compiler';

const capabilities: PromptCapabilities = {
  supportsDeveloperRole: false,
  systemPlacement: 'initial_only',
  supportsMultipleSystemMessages: false,
  requiresAlternatingRoles: true,
  contextWindowTokens: 8192,
  tokenizerType: 'estimated_chars_v1'
};

describe('Provider Prompt Compiler', () => {
  it('preserves conversation roles and deterministic ordering', () => {
    const result = compilePromptSections({
      sections: [
        section('current', 'current_user', 'required', '你好', 0, 'user'),
        section('policy', 'instruction', 'required', '规则', 0)
      ],
      purpose: 'chat_reply',
      capabilities,
      maxPromptTokens: 100
    });
    expect(result.messages.map((message) => message.role)).toEqual(['system', 'user']);
  });

  it('uses only a fresh compact and never silently truncates required content', () => {
    const optional = section('optional', 'before_history', 'optional', '很长'.repeat(100), 1);
    optional.compactContent = '短';
    optional.compactSourceHash = canonicalSha256(optional.content);
    const result = compilePromptSections({
      sections: [section('policy', 'instruction', 'required', '规则', 0), optional],
      purpose: 'chat_reply',
      capabilities,
      maxPromptTokens: 20
    });
    expect(result.sections.find((item) => item.section.id === 'optional')?.compactUsed).toBe(true);
    expect(() =>
      compilePromptSections({
        sections: [section('required', 'instruction', 'required', '超长'.repeat(100), 0)],
        purpose: 'chat_reply',
        capabilities,
        maxPromptTokens: 1
      })
    ).toThrow();
  });

  it('rejects a stale compact source hash and keeps the canonical full content', () => {
    const optional = section('optional', 'before_history', 'optional', 'canonical full content', 1);
    optional.compactContent = 'obsolete compact';
    optional.compactSourceHash = canonicalSha256('older source');
    const result = compilePromptSections({
      sections: [section('policy', 'instruction', 'required', 'rule', 0), optional],
      purpose: 'chat_reply',
      capabilities,
      maxPromptTokens: 100
    });
    const compiled = result.sections.find((item) => item.section.id === 'optional');
    expect(compiled).toMatchObject({ included: true, compactUsed: false });
    expect(result.messages.map((item) => item.content).join('\n')).toContain(
      'canonical full content'
    );
    expect(result.messages.map((item) => item.content).join('\n')).not.toContain(
      'obsolete compact'
    );
  });
});

function section(
  id: string,
  placement: PromptSectionV2['placement'],
  importance: PromptSectionV2['importance'],
  content: string,
  sortOrder: number,
  conversationRole?: PromptSectionV2['conversationRole']
): PromptSectionV2 {
  return {
    id,
    kind: placement === 'current_user' ? 'current_user' : 'platform_policy',
    sourceType: 'test',
    content,
    placement,
    importance,
    budgetPriority: 0,
    sortOrder,
    truncationPolicy: importance === 'required' ? 'never' : 'use_compact',
    generationPurposes: ['chat_reply'],
    conversationRole
  };
}
