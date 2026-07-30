import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS,
  PROMPT_BUILDER_DEFAULT_OUTPUT_RULES,
  PROMPT_BUILDER_PLATFORM_RULES,
  PROMPT_BUILDER_SUGGESTION_OUTPUT_RULES,
  PROMPT_BUILDER_SUGGESTION_PLATFORM_RULES
} from '../prompt-builder/prompt-builder.constants';
import type { BuildPromptInput, ChatMessageLike } from '../prompt-builder/types';
import type { GenerationPurpose } from './generation-lifecycle.types';
import { mergePresetOutputRules } from './preset-rule-compiler';
import type { PromptSectionV2 } from './prompt-section.types';

/** Directly builds provider-neutral atomic sections from structured Tavern sources. */
export function buildTavernPromptSections(
  input: BuildPromptInput,
  purpose: GenerationPurpose
): PromptSectionV2[] {
  const sections: PromptSectionV2[] = [];
  const variables = {
    characterName: input.character.name,
    userName: input.persona?.name || 'User'
  };
  const add = (
    section: Omit<PromptSectionV2, 'generationPurposes'> & {
      generationPurposes?: GenerationPurpose[];
    }
  ) => {
    const content = resolveVariables(section.content, variables).trim();
    if (!content) return;
    sections.push({
      ...section,
      content,
      generationPurposes: section.generationPurposes ?? [purpose]
    });
  };
  const suggestion = purpose === 'user_suggestions';

  add({
    id: 'tavern:platform-policy',
    kind: 'platform_policy',
    sourceType: 'system',
    content: (suggestion
      ? PROMPT_BUILDER_SUGGESTION_PLATFORM_RULES
      : PROMPT_BUILDER_PLATFORM_RULES
    ).join('\n'),
    placement: 'instruction',
    importance: 'required',
    budgetPriority: 1000,
    sortOrder: 0,
    truncationPolicy: 'never'
  });
  add({
    id: `character:${input.character.id}:core`,
    kind: 'character_core',
    sourceType: 'character_core',
    sourceId: input.character.id,
    content: [`Character: ${input.character.name}`, input.character.coreIdentity]
      .filter(Boolean)
      .join('\n'),
    placement: 'instruction',
    importance: 'required',
    budgetPriority: 950,
    sortOrder: 10,
    truncationPolicy: 'never'
  });
  addCharacterSection(
    add,
    input.character.id,
    'personality',
    'character_personality',
    input.character.personality,
    20
  );
  addCharacterSection(
    add,
    input.character.id,
    'premise',
    'character_premise',
    input.character.persistentPremise,
    30
  );
  const firstTurn = input.history.length === 0;
  if (firstTurn) {
    addCharacterSection(
      add,
      input.character.id,
      'initial-scenario',
      'character_initial_scenario',
      input.character.initialScenario,
      40
    );
  }
  addCharacterSection(
    add,
    input.character.id,
    'background',
    'character_background',
    input.character.extendedBackground,
    50
  );
  addCharacterSection(
    add,
    input.character.id,
    'rules',
    'character_rule',
    input.character.characterRules,
    60,
    'reserved'
  );
  if (!suggestion) {
    addCharacterSection(
      add,
      input.character.id,
      'speech-style',
      'character_rule',
      input.character.speechStyle,
      70
    );
  }
  if (firstTurn) {
    addCharacterSection(
      add,
      input.character.id,
      'first-message',
      'generation_hint',
      input.character.firstMessage,
      80
    );
    (input.character.exampleMessages ?? []).forEach((message, index) =>
      add({
        id: `character:${input.character.id}:example:${index}`,
        kind: 'generation_hint',
        sourceType: 'character_example_message',
        sourceId: input.character.id,
        content: `${message.role}: ${message.content}`,
        placement: 'instruction',
        importance: 'optional',
        budgetPriority: 250,
        sortOrder: 90 + index,
        truncationPolicy: 'drop'
      })
    );
  }

  if (input.persona) {
    addProfileSection(
      add,
      input.persona.id,
      'core',
      'persona_core',
      input.persona.coreIdentity,
      110
    );
    addProfileSection(
      add,
      input.persona.id,
      'background',
      'persona_background',
      input.persona.background,
      120
    );
    addProfileSection(
      add,
      input.persona.id,
      'preference',
      'persona_preference',
      input.persona.interactionPreferences,
      130
    );
  }

  const presetPurposes: GenerationPurpose[] = input.promptPreset?.generationPurposes?.length
    ? input.promptPreset.generationPurposes
    : ['chat_reply', 'regenerate', 'continue'];
  const presetApplies = Boolean(input.promptPreset && presetPurposes.includes(purpose));
  if (input.promptPreset && presetApplies) {
    const instructions = input.promptPreset.instructions ?? [];
    instructions.forEach((content, index) =>
      add({
        id: `preset:${input.promptPreset!.id}:instruction:${index}`,
        kind: 'preset_instruction',
        sourceType: 'prompt_preset_instruction',
        sourceId: input.promptPreset!.id,
        content,
        placement: 'instruction',
        importance: 'reserved',
        budgetPriority: 550,
        sortOrder: 150 + index,
        truncationPolicy: 'drop',
        generationPurposes: presetPurposes
      })
    );
  }
  if (!suggestion) {
    const baseRules = [
      {
        key: 'natural_expression',
        content: PROMPT_BUILDER_DEFAULT_OUTPUT_RULES[0],
        optional: true,
        sortOrder: 200
      },
      {
        key: 'direct_response',
        content: PROMPT_BUILDER_DEFAULT_OUTPUT_RULES[1],
        optional: true,
        sortOrder: 201
      },
      {
        key: 'focused_beat',
        content: PROMPT_BUILDER_DEFAULT_OUTPUT_RULES[2],
        optional: true,
        sortOrder: 202
      }
    ];
    const mergedRules = mergePresetOutputRules(
      baseRules,
      input.promptPreset && presetApplies ? (input.promptPreset.outputRuleOperations ?? []) : []
    );
    const systemRuleKeys = new Set(['natural_expression', 'direct_response', 'focused_beat']);
    mergedRules.forEach((rule) => {
      const systemOwned = systemRuleKeys.has(rule.key);
      add({
        id: systemOwned
          ? `output-rule:${rule.key}`
          : `preset:${input.promptPreset!.id}:output-rule:${rule.key}`,
        kind: 'preset_output_rule',
        sourceType: systemOwned ? 'system_output_rule' : 'prompt_preset_output_rule',
        sourceId: systemOwned ? undefined : input.promptPreset?.id,
        content: rule.content,
        placement: 'instruction',
        importance: 'reserved',
        budgetPriority: 600,
        sortOrder: rule.sortOrder,
        truncationPolicy: 'drop'
      });
    });
  } else {
    add({
      id: 'tavern:suggestion-output-rules',
      kind: 'preset_output_rule',
      sourceType: 'system_output_rule',
      content: PROMPT_BUILDER_SUGGESTION_OUTPUT_RULES.join('\n'),
      placement: 'instruction',
      importance: 'required',
      budgetPriority: 800,
      sortOrder: 200,
      truncationPolicy: 'never'
    });
  }
  const history = selectHistory(input.history, input.currentUserMessage, input.options);
  history.forEach((message, index) =>
    add({
      id: `history:${message.id}`,
      kind: 'history',
      sourceType: 'message',
      sourceId: message.id,
      content: message.content,
      placement: 'history',
      importance: 'reserved',
      budgetPriority: 650 + index,
      sortOrder: 1000 + index,
      truncationPolicy: 'drop',
      conversationRole: toConversationRole(message.role)
    })
  );
  add({
    id: `current-user:${input.currentUserMessage.id}`,
    kind: 'current_user',
    sourceType: 'runtime_user_message',
    sourceId: input.currentUserMessage.id,
    content: input.currentUserMessage.content,
    placement: 'current_user',
    importance: 'required',
    budgetPriority: 1100,
    sortOrder: 2000,
    truncationPolicy: 'never',
    conversationRole: 'user'
  });
  return sections;
}

function addCharacterSection(
  add: (section: Omit<PromptSectionV2, 'generationPurposes'>) => void,
  sourceId: string,
  suffix: string,
  kind: PromptSectionV2['kind'],
  content: string | undefined,
  sortOrder: number,
  importance: PromptSectionV2['importance'] = 'optional'
) {
  add({
    id: `character:${sourceId}:${suffix}`,
    kind,
    sourceType: `character_${suffix.replaceAll('-', '_')}`,
    sourceId,
    content: content ?? '',
    placement: 'instruction',
    importance,
    budgetPriority: importance === 'reserved' ? 700 : 400,
    sortOrder,
    truncationPolicy: 'drop'
  });
}

function addProfileSection(
  add: (section: Omit<PromptSectionV2, 'generationPurposes'>) => void,
  sourceId: string,
  suffix: string,
  kind: PromptSectionV2['kind'],
  content: string,
  sortOrder: number
) {
  add({
    id: `persona:${sourceId}:${suffix}`,
    kind,
    sourceType: `persona_${suffix}`,
    sourceId,
    content,
    placement: 'instruction',
    importance: 'reserved',
    budgetPriority: 650,
    sortOrder,
    truncationPolicy: 'drop'
  });
}

function selectHistory(
  history: ChatMessageLike[],
  current: ChatMessageLike,
  options: BuildPromptInput['options']
): ChatMessageLike[] {
  const candidates = history.filter(
    (message) =>
      message.id !== current.id &&
      message.status !== 'deleted' &&
      message.status !== 'failed' &&
      message.status !== 'generating' &&
      (message.role === 'user' || message.role === 'assistant' || message.role === 'tool')
  );
  const limit = options.historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT;
  const maxCharacters =
    options.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS;
  const selected: ChatMessageLike[] = [];
  let characters = 0;
  for (const message of candidates.slice(-limit).reverse()) {
    if (selected.length && characters + message.content.length > maxCharacters) break;
    selected.push(message);
    characters += message.content.length;
  }
  return selected.reverse();
}

function toConversationRole(role: string): 'user' | 'assistant' | 'tool' {
  return role === 'assistant' || role === 'tool' ? role : 'user';
}

function resolveVariables(
  content: string,
  variables: { characterName: string; userName: string }
): string {
  return content
    .replace(/\{\{\s*(?:char|character)\s*\}\}/gi, variables.characterName)
    .replace(/\{\{\s*user\s*\}\}/gi, variables.userName);
}
