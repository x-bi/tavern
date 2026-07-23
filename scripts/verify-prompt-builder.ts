import assert from 'node:assert/strict';

import { buildCompanionPromptSections } from '../apps/server/src/services/context-engine/companion-prompt-section-builder';
import { buildTavernPromptSections } from '../apps/server/src/services/context-engine/prompt-section-builder';
import { compilePromptSections } from '../apps/server/src/services/context-engine/provider-prompt-compiler';
import type { BuildPromptInput } from '../apps/server/src/services/prompt-builder/types';

const capabilities = {
  supportsDeveloperRole: false,
  systemPlacement: 'initial_only' as const,
  supportsMultipleSystemMessages: false,
  requiresAlternatingRoles: true,
  contextWindowTokens: 8192,
  tokenizerType: 'estimated_chars_v1'
};

function tavernInput(history: BuildPromptInput['history'] = []): BuildPromptInput {
  return {
    userId: 'user-1',
    conversation: {
      id: 'conversation-1',
      userId: 'user-1',
      characterId: 'character-1',
      title: 'Test'
    },
    character: {
      id: 'character-1',
      name: 'Mira',
      coreIdentity: 'Lantern keeper',
      personality: 'Calm',
      persistentPremise: 'Protects the archive',
      initialScenario: 'At the gate',
      extendedBackground: '',
      characterRules: '',
      speechStyle: '',
      firstMessage: 'Welcome.',
      exampleMessages: [
        {
          id: 'example-1',
          conversationId: 'conversation-1',
          role: 'assistant',
          content: 'Come in.'
        }
      ]
    },
    persona: null,
    promptPreset: {
      id: 'preset-1',
      name: 'Preset',
      description: '',
      instructions: [],
      generationPurposes: ['chat_reply'],
      parameters: null,
      outputRuleOperations: [
        { key: 'direct_response', content: '', operation: 'disable_optional', sortOrder: 1 }
      ]
    },
    modelGateway: null,
    history,
    currentUserMessage: {
      id: 'current',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'Hello'
    },
    worldBooks: [],
    options: { mode: 'chat', maxPromptTokens: 8000 }
  };
}

const firstTurn = buildTavernPromptSections(tavernInput(), 'chat_reply');
assert.ok(firstTurn.some((section) => section.sourceType === 'character_first_message'));
assert.ok(firstTurn.some((section) => section.sourceType === 'character_example_message'));
assert.ok(!firstTurn.some((section) => section.id === 'output-rule:direct_response'));

const laterTurn = buildTavernPromptSections(
  tavernInput([{ id: 'old', conversationId: 'conversation-1', role: 'user', content: 'Earlier' }]),
  'chat_reply'
);
assert.ok(!laterTurn.some((section) => section.sourceType === 'character_first_message'));
assert.ok(!laterTurn.some((section) => section.sourceType === 'character_example_message'));

const companionSections = buildCompanionPromptSections(
  {
    name: 'Luna',
    coreIdentity: 'Astronomer',
    history: [],
    userInput: 'Hello',
    memory: {
      isEnabled: true,
      relationshipState: 'Mutual trust',
      currentArc: 'Stargazing',
      status: 'ready'
    }
  },
  'chat_reply'
);
const compiled = compilePromptSections({
  sections: companionSections,
  purpose: 'chat_reply',
  capabilities,
  maxPromptTokens: 8000
});
const prompt = compiled.messages.map((message) => message.content).join('\n');
assert.match(prompt, /Mutual trust/);
assert.match(prompt, /稳定、独立的人格和主观能动性/);
assert.match(prompt, /表达方式首先服从 Companion identity/);

console.log('Context Engine Prompt regression checks passed.');
