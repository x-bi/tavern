import type { ProviderChatMessage } from '../prompt-builder/types';
import type { GenerationPurpose } from './generation-lifecycle.types';
import type {
  CompiledPrompt,
  CompiledPromptSection,
  PromptCapabilities,
  PromptSectionV2
} from './prompt-section.types';
import { estimatePromptTextTokens } from '../prompt-builder/token-estimator';
import { canonicalSha256 } from '../../common/canonical-json';

export const CONTEXT_COMPILER_VERSION = 'context-compiler-v2.0.0';
const PLACEMENT_ORDER = [
  'instruction',
  'before_history',
  'history',
  'after_history',
  'before_current_user',
  'current_user'
] as const;
const IMPORTANCE_ORDER = { required: 0, reserved: 1, optional: 2 } as const;

export function compilePromptSections(input: {
  sections: PromptSectionV2[];
  purpose: GenerationPurpose;
  capabilities: PromptCapabilities;
  maxPromptTokens: number;
}): CompiledPrompt {
  const eligible = input.sections
    .filter((section) => section.generationPurposes.includes(input.purpose))
    .map((section) => prepare(section));
  const selected = selectAtomicSections(eligible, input.maxPromptTokens);
  const ordered = selected.filter((item) => item.included).sort(compareCompiledSections);
  const messages = repairProviderMessages(
    ordered.map((item) => {
      const role = roleFor(item.section, input.capabilities);
      item.finalProviderRole = role;
      return {
        role,
        content: item.compactUsed ? item.section.compactContent! : item.section.content
      };
    }),
    input.capabilities
  );
  const tokenEstimate = messages.reduce(
    (sum, message) => sum + estimatePromptTextTokens(message.content) + 4,
    0
  );
  if (tokenEstimate > input.maxPromptTokens) {
    throw Object.assign(new Error('Compiled required prompt exceeds the model context budget.'), {
      code: 'PROMPT_REQUIRED_BUDGET_EXCEEDED'
    });
  }
  return { messages, sections: selected, tokenEstimate, compilerVersion: CONTEXT_COMPILER_VERSION };
}

function prepare(section: PromptSectionV2): CompiledPromptSection {
  const compactValid = Boolean(
    section.compactContent && section.compactSourceHash === canonicalSha256(section.content)
  );
  return {
    section,
    included: true,
    compactUsed: false,
    tokenEstimate: estimatePromptTextTokens(section.content),
    excludedReason: compactValid || !section.compactContent ? null : 'compact_stale',
    finalProviderRole: null
  };
}

function selectAtomicSections(
  items: CompiledPromptSection[],
  budget: number
): CompiledPromptSection[] {
  const ranked = [...items].sort(
    (left, right) =>
      IMPORTANCE_ORDER[left.section.importance] - IMPORTANCE_ORDER[right.section.importance] ||
      right.section.budgetPriority - left.section.budgetPriority ||
      left.section.sortOrder - right.section.sortOrder ||
      left.section.id.localeCompare(right.section.id)
  );
  let used = 0;
  for (const item of ranked) {
    const full = item.tokenEstimate;
    if (used + full <= budget) {
      used += full;
      continue;
    }
    const compactValid = Boolean(
      item.section.compactContent &&
      item.section.compactSourceHash === canonicalSha256(item.section.content)
    );
    if (item.section.truncationPolicy === 'use_compact' && compactValid) {
      const compactTokens = estimatePromptTextTokens(item.section.compactContent!);
      if (used + compactTokens <= budget) {
        item.compactUsed = true;
        item.tokenEstimate = compactTokens;
        used += compactTokens;
        continue;
      }
    }
    if (item.section.importance === 'required' || item.section.truncationPolicy === 'never') {
      throw Object.assign(new Error(`Required section ${item.section.id} exceeds prompt budget.`), {
        code: 'PROMPT_REQUIRED_BUDGET_EXCEEDED'
      });
    }
    item.included = false;
    item.excludedReason = compactValid
      ? 'budget_excluded'
      : (item.excludedReason ?? 'budget_excluded');
  }
  return items;
}

function compareCompiledSections(
  left: CompiledPromptSection,
  right: CompiledPromptSection
): number {
  return (
    PLACEMENT_ORDER.indexOf(left.section.placement) -
      PLACEMENT_ORDER.indexOf(right.section.placement) ||
    left.section.sortOrder - right.section.sortOrder ||
    left.section.id.localeCompare(right.section.id)
  );
}

function roleFor(
  section: PromptSectionV2,
  capabilities: PromptCapabilities
): ProviderChatMessage['role'] {
  if (section.conversationRole) return section.conversationRole;
  if (section.placement === 'current_user') return 'user';
  return capabilities.supportsDeveloperRole ? 'developer' : 'system';
}

function repairProviderMessages(
  messages: ProviderChatMessage[],
  capabilities: PromptCapabilities
): ProviderChatMessage[] {
  const instruction = messages.filter(
    (message) => message.role === 'system' || message.role === 'developer'
  );
  const conversation = messages.filter(
    (message) => message.role !== 'system' && message.role !== 'developer'
  );
  let repaired =
    capabilities.systemPlacement === 'initial_only' ? [...instruction, ...conversation] : messages;
  if (!capabilities.supportsMultipleSystemMessages) {
    const system = repaired.filter((message) => message.role === 'system');
    repaired = repaired.filter((message) => message.role !== 'system');
    if (system.length)
      repaired.unshift({
        role: 'system',
        content: system.map((item) => item.content).join('\n\n')
      });
  }
  if (capabilities.requiresAlternatingRoles) {
    repaired = repaired.reduce<ProviderChatMessage[]>((result, message) => {
      const previous = result.at(-1);
      if (
        previous &&
        previous.role === message.role &&
        (message.role === 'user' || message.role === 'assistant')
      ) {
        previous.content += `\n\n${message.content}`;
      } else result.push({ ...message });
      return result;
    }, []);
  }
  return repaired;
}
