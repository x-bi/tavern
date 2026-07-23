import { describe, expect, it } from 'vitest';
import { buildCompanionPromptSections } from '../../src/services/context-engine/companion-prompt-section-builder';

describe('Companion atomic prompt section builder', () => {
  it('keeps identity, persona, runtime state and active memory revisions separately traceable', () => {
    const sections = buildCompanionPromptSections(
      {
        companionId: 'companion',
        name: '伙伴',
        coreIdentity: '核心身份',
        personality: '人格',
        speechStyle: '风格',
        relationshipDefaults: '关系前提',
        personaProfile: {
          id: 'persona',
          coreIdentity: '用户核心',
          background: '用户背景',
          interactionPreferences: '用户偏好'
        },
        preset: null,
        memory: {
          isEnabled: true,
          status: 'pending',
          revisionId: 'memory-revision',
          relationshipState: '稳定关系',
          currentArc: '近期主线'
        },
        runtimeState: { currentMood: '开心', currentSituation: '散步', version: 7 },
        history: [{ id: 'message', role: 'user', content: '历史' }],
        userInput: '当前输入'
      },
      'chat_reply'
    );
    expect(sections.find((section) => section.kind === 'companion_memory')).toMatchObject({
      sourceRevisionId: 'memory-revision'
    });
    expect(
      sections.filter((section) => section.sourceId === 'persona').map((section) => section.kind)
    ).toEqual(['persona_core', 'persona_background', 'persona_preference']);
    expect(sections.find((section) => section.kind === 'companion_runtime_state')).toMatchObject({
      sourceRevisionId: '7'
    });
    expect(sections.find((section) => section.sourceId === 'message')).toMatchObject({
      conversationRole: 'user'
    });
  });

  it('never injects stale memory', () => {
    const sections = buildCompanionPromptSections(
      {
        name: '伙伴',
        coreIdentity: '身份',
        memory: {
          isEnabled: true,
          status: 'stale',
          revisionId: 'stale',
          relationshipState: '陈旧',
          currentArc: ''
        },
        history: [],
        userInput: '你好'
      },
      'chat_reply'
    );
    expect(sections.some((section) => section.kind === 'companion_memory')).toBe(false);
  });
});
