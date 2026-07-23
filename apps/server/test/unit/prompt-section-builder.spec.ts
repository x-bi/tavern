import { describe, expect, it } from 'vitest';
import { buildTavernPromptSections } from '../../src/services/context-engine/prompt-section-builder';
import type { BuildPromptInput } from '../../src/services/prompt-builder/types';

function input(): BuildPromptInput {
  return {
    userId: 'user',
    conversation: { id: 'conversation', userId: 'user', characterId: 'character', title: 'Thread' },
    character: {
      id: 'character',
      name: '角色',
      coreIdentity: '核心身份',
      personality: '人格',
      persistentPremise: '持续前提',
      initialScenario: '初始场景',
      extendedBackground: '背景',
      characterRules: '角色规则',
      speechStyle: '说话风格',
      firstMessage: '开场白',
      exampleMessages: []
    },
    persona: {
      id: 'persona',
      name: '用户',
      coreIdentity: '用户核心',
      background: '用户背景',
      interactionPreferences: '互动偏好'
    },
    promptPreset: {
      id: 'preset',
      name: '预设',
      description: '',
      instructions: ['原子指令'],
      outputRuleOperations: [
        { key: 'style', content: '附加风格规则', operation: 'add', sortOrder: 1 }
      ],
      generationPurposes: ['chat_reply'],
      parameters: null
    },
    modelGateway: null,
    history: [
      { id: 'old', conversationId: 'conversation', role: 'user', content: '旧消息' },
      { id: 'new', conversationId: 'conversation', role: 'assistant', content: '新消息' }
    ],
    currentUserMessage: {
      id: 'current',
      conversationId: 'conversation',
      role: 'user',
      content: '当前输入'
    },
    worldBooks: [],
    options: { mode: 'chat', purpose: 'chat_reply' }
  };
}

describe('Tavern atomic prompt section builder', () => {
  it('keeps profile fields and preset operations as individually traceable sections', () => {
    const sections = buildTavernPromptSections(input(), 'chat_reply');
    expect(
      sections.filter((section) => section.sourceId === 'character').map((section) => section.kind)
    ).toEqual(
      expect.arrayContaining([
        'character_core',
        'character_personality',
        'character_premise',
        'character_background',
        'character_rule'
      ])
    );
    expect(
      sections.filter((section) => section.sourceId === 'persona').map((section) => section.kind)
    ).toEqual(['persona_core', 'persona_background', 'persona_preference']);
    expect(sections.some((section) => section.content === '附加风格规则')).toBe(true);
    expect(sections.some((section) => section.id === 'output-rule:natural_expression')).toBe(true);
    expect(sections.some((section) => section.sourceType === 'character_initial_scenario')).toBe(
      false
    );
    expect(sections.find((section) => section.sourceId === 'new')!.budgetPriority).toBeGreaterThan(
      sections.find((section) => section.sourceId === 'old')!.budgetPriority
    );
  });

  it('does not apply a preset outside its declared generation purposes', () => {
    const sections = buildTavernPromptSections(input(), 'regenerate');
    expect(sections.some((section) => section.sourceId === 'preset')).toBe(false);
    expect(sections.some((section) => section.id === 'output-rule:natural_expression')).toBe(true);
  });
});
