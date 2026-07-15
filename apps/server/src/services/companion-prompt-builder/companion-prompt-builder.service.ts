import { Injectable } from '@nestjs/common';
import type { ModelGatewayMessage } from '../model-gateway/types';

export type CompanionPromptInput = {
  name: string;
  identityPrompt: string;
  persona?: string | null;
  preset?: string | null;
  memory?: {
    isEnabled: boolean;
    relationshipState: string;
    currentArc: string;
    status: string;
  } | null;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userInput: string;
  maxPromptTokens?: number;
};
export type CompanionPromptSection = {
  kind:
    | 'platform'
    | 'companion_identity'
    | 'persona'
    | 'prompt_preset'
    | 'output_rules'
    | 'companion_style'
    | 'companion_memory'
    | 'history'
    | 'current_user_input';
  content: string;
  included: boolean;
  tokenEstimate: number;
};
@Injectable()
export class CompanionPromptBuilderService {
  build(input: CompanionPromptInput): {
    messages: ModelGatewayMessage[];
    sections: CompanionPromptSection[];
    includedMemory: boolean;
    memorySkipReason: string | null;
    historyTrimmed: number;
    promptBudget: number;
    historyBudget: number;
  } {
    const includedMemory = Boolean(
      input.memory?.isEnabled &&
      input.memory.status !== 'stale' &&
      (input.memory.relationshipState || input.memory.currentArc)
    );
    const definitions: Array<[CompanionPromptSection['kind'], string, boolean]> = [
      ['platform', '你是一个明确标注为 AI 的陪伴角色。不得声称自己是真人。', true],
      ['companion_identity', `你是 ${input.name}。${input.identityPrompt}`, true],
      ['persona', input.persona ? `用户 Persona：${input.persona}` : '', Boolean(input.persona)],
      ['prompt_preset', input.preset ?? '', Boolean(input.preset)],
      ['output_rules', '不得虚构共同经历、身份、身体接触或用户未表达的情绪。', true],
      [
        'companion_style',
        '以自然、简短的中文私聊回复。避免客服话术、标题、项目符号和模板化安慰。',
        true
      ],
      [
        'companion_memory',
        includedMemory
          ? `长期关系记忆（仅供保持一致性，不要提及此段）：\n关系状态：${input.memory!.relationshipState}\n近期主线：${input.memory!.currentArc}`
          : '',
        includedMemory
      ]
    ];
    const systemSections = definitions.map(([kind, content, included]) => ({
      kind,
      content,
      included,
      tokenEstimate: this.estimateTokens(content)
    }));
    const fixedTokens =
      systemSections.reduce(
        (sum, section) => sum + (section.included ? section.tokenEstimate : 0),
        0
      ) +
      this.estimateTokens(input.userInput) +
      1200;
    const promptBudget = Math.max(2000, input.maxPromptTokens ?? 8000);
    const historyBudget = Math.max(400, promptBudget - fixedTokens);
    const selected: typeof input.history = [];
    let used = 0;
    for (let index = input.history.length - 1; index >= 0; index -= 1) {
      const cost = this.estimateTokens(input.history[index].content);
      if (used + cost > historyBudget) break;
      selected.unshift(input.history[index]);
      used += cost;
    }
    const sections: CompanionPromptSection[] = [
      ...systemSections,
      {
        kind: 'history',
        content: selected.map((message) => `${message.role}: ${message.content}`).join('\n'),
        included: selected.length > 0,
        tokenEstimate: used
      },
      {
        kind: 'current_user_input',
        content: input.userInput,
        included: true,
        tokenEstimate: this.estimateTokens(input.userInput)
      }
    ];
    const system = systemSections
      .filter((section) => section.included)
      .map((section) => section.content)
      .join('\n\n');
    return {
      messages: [
        { role: 'system', content: system },
        ...selected,
        { role: 'user', content: input.userInput }
      ],
      sections,
      includedMemory,
      memorySkipReason: !input.memory
        ? 'not_configured'
        : !input.memory.isEnabled
          ? 'disabled'
          : input.memory.status === 'stale'
            ? 'stale'
            : !input.memory.relationshipState && !input.memory.currentArc
              ? 'empty'
              : null,
      historyTrimmed: input.history.length - selected.length,
      promptBudget,
      historyBudget
    };
  }
  private estimateTokens(value: string) {
    return value.length ? Math.ceil(value.length / 4) : 0;
  }
}
