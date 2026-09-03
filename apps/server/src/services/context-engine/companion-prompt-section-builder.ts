import {
  COMPANION_PLATFORM_RULES,
  COMPANION_PROACTIVE_CHAT_RULE,
  COMPANION_STYLE_RULE,
  MEMORY_CONTEXT_RULE,
  type CompanionPromptInput
} from './companion-prompt-contract';
import type { GenerationPurpose } from './generation-lifecycle.types';
import type { PromptSectionV2 } from './prompt-section.types';
import { mergePresetOutputRules } from './preset-rule-compiler';

/** Builds atomic Companion sections directly from structured sources. */
export function buildCompanionPromptSections(
  input: CompanionPromptInput,
  purpose: GenerationPurpose
): PromptSectionV2[] {
  const sections: PromptSectionV2[] = [];
  const add = (section: Omit<PromptSectionV2, 'generationPurposes'>) => {
    const content = section.content.trim();
    if (content) sections.push({ ...section, content, generationPurposes: [purpose] });
  };
  const companionId = input.companionId ?? input.name;
  add({
    id: 'companion:platform-policy',
    kind: 'platform_policy',
    sourceType: 'system',
    content: COMPANION_PLATFORM_RULES.join('\n'),
    placement: 'instruction',
    importance: 'required',
    budgetPriority: 1000,
    sortOrder: 0,
    truncationPolicy: 'never'
  });
  addAtomic(
    add,
    companionId,
    'core',
    'companion_core',
    `Companion: ${input.name}\n${input.coreIdentity ?? ''}`,
    10,
    'required'
  );
  addAtomic(add, companionId, 'personality', 'companion_personality', input.personality, 20);
  addAtomic(add, companionId, 'style', 'companion_style', input.speechStyle, 30);
  addAtomic(
    add,
    companionId,
    'relationship-defaults',
    'companion_core',
    input.relationshipDefaults,
    40
  );

  if (input.personaProfile) {
    addProfile(
      add,
      input.personaProfile.id,
      'core',
      'persona_core',
      input.personaProfile.coreIdentity,
      60
    );
    addProfile(
      add,
      input.personaProfile.id,
      'background',
      'persona_background',
      input.personaProfile.background,
      70
    );
    addProfile(
      add,
      input.personaProfile.id,
      'preference',
      'persona_preference',
      input.personaProfile.interactionPreferences,
      80
    );
  }

  const presetPurposes = input.preset?.generationPurposes?.length
    ? input.preset.generationPurposes
    : ['chat_reply', 'regenerate', 'continue'];
  const presetApplies =
    presetPurposes.includes(purpose) ||
    (purpose === 'proactive_chat' && presetPurposes.includes('chat_reply'));
  if (input.preset && presetApplies) {
    (input.preset.instructions ?? []).forEach((content, index) =>
      add({
        id: `companion-preset:${input.preset!.id ?? 'bound'}:instruction:${index}`,
        kind: 'preset_instruction',
        sourceType: 'prompt_preset_instruction',
        sourceId: input.preset!.id,
        content,
        placement: 'instruction',
        importance: 'optional',
        budgetPriority: 450,
        sortOrder: 100 + index,
        truncationPolicy: 'drop'
      })
    );
    mergePresetOutputRules(
      [{ key: 'companion_style', content: COMPANION_STYLE_RULE, optional: true, sortOrder: 130 }],
      input.preset.outputRuleOperations ?? []
    ).forEach((rule) =>
      add({
        id: `companion-output-rule:${rule.key}`,
        kind: 'preset_output_rule',
        sourceType:
          rule.key === 'companion_style' ? 'managed_companion_style' : 'prompt_preset_output_rule',
        sourceId: rule.key === 'companion_style' ? companionId : input.preset!.id,
        content: rule.content,
        placement: 'instruction',
        importance: 'reserved',
        budgetPriority: 650,
        sortOrder: rule.sortOrder,
        truncationPolicy: 'drop'
      })
    );
  }
  if (!input.preset || !presetApplies) {
    add({
      id: 'companion-output-rule:companion_style',
      kind: 'companion_style',
      sourceType: 'managed_companion_style',
      sourceId: companionId,
      content: COMPANION_STYLE_RULE,
      placement: 'instruction',
      importance: 'reserved',
      budgetPriority: 650,
      sortOrder: 130,
      truncationPolicy: 'drop'
    });
  }
  if (input.runtimeState?.currentMood || input.runtimeState?.currentSituation) {
    add({
      id: `companion:${companionId}:runtime-state`,
      kind: 'companion_runtime_state',
      sourceType: 'companion_runtime_state',
      sourceId: companionId,
      sourceRevisionId:
        input.runtimeState.version === undefined ? undefined : String(input.runtimeState.version),
      content: [
        input.runtimeState.currentMood ? `当前心情：${input.runtimeState.currentMood}` : '',
        input.runtimeState.currentSituation
          ? `当前处境：${input.runtimeState.currentSituation}`
          : ''
      ]
        .filter(Boolean)
        .join('\n'),
      placement: 'before_history',
      importance: 'reserved',
      budgetPriority: 750,
      sortOrder: 180,
      truncationPolicy: 'drop'
    });
  }
  if (input.memory?.isEnabled && input.memory.status !== 'stale') {
    add({
      id: `companion-memory:${input.memory.revisionId ?? 'active'}`,
      kind: 'companion_memory',
      sourceType: 'companion_memory_revision',
      sourceId: companionId,
      sourceRevisionId: input.memory.revisionId ?? undefined,
      content: [MEMORY_CONTEXT_RULE, input.memory.relationshipState, input.memory.currentArc]
        .filter(Boolean)
        .join('\n'),
      placement: 'before_history',
      importance: 'reserved',
      budgetPriority: 800,
      sortOrder: 190,
      truncationPolicy: 'drop'
    });
  }
  input.history.forEach((message, index) =>
    add({
      id: `companion-history:${message.id ?? index}`,
      kind: 'history',
      sourceType: 'companion_message',
      sourceId: message.id,
      content: message.content,
      placement: 'history',
      importance: 'reserved',
      budgetPriority: 650 + index,
      sortOrder: 1000 + index,
      truncationPolicy: 'drop',
      conversationRole: message.role
    })
  );
  add(
    purpose === 'proactive_chat'
      ? {
          id: 'companion:proactive-chat',
          kind: 'generation_hint',
          sourceType: 'managed_proactive_chat',
          content: COMPANION_PROACTIVE_CHAT_RULE,
          placement: 'current_user',
          importance: 'required',
          budgetPriority: 1100,
          sortOrder: 2000,
          truncationPolicy: 'never',
          conversationRole: 'user'
        }
      : {
          id: 'companion:current-user',
          kind: 'current_user',
          sourceType: 'runtime_user_message',
          content: input.userInput,
          placement: 'current_user',
          importance: 'required',
          budgetPriority: 1100,
          sortOrder: 2000,
          truncationPolicy: 'never',
          conversationRole: 'user'
        }
  );
  return sections;
}

function addAtomic(
  add: (section: Omit<PromptSectionV2, 'generationPurposes'>) => void,
  sourceId: string,
  suffix: string,
  kind: PromptSectionV2['kind'],
  content: string | undefined,
  sortOrder: number,
  importance: PromptSectionV2['importance'] = 'optional'
) {
  add({
    id: `companion:${sourceId}:${suffix}`,
    kind,
    sourceType: `companion_${suffix.replaceAll('-', '_')}`,
    sourceId,
    content: content ?? '',
    placement: 'instruction',
    importance,
    budgetPriority: importance === 'required' ? 950 : 500,
    sortOrder,
    truncationPolicy: importance === 'required' ? 'never' : 'drop'
  });
}

function addProfile(
  add: (section: Omit<PromptSectionV2, 'generationPurposes'>) => void,
  sourceId: string,
  suffix: string,
  kind: PromptSectionV2['kind'],
  content: string,
  sortOrder: number
) {
  add({
    id: `companion-persona:${sourceId}:${suffix}`,
    kind,
    sourceType: `persona_${suffix}`,
    sourceId,
    content,
    placement: 'instruction',
    importance: 'reserved',
    budgetPriority: 600,
    sortOrder,
    truncationPolicy: 'drop'
  });
}
