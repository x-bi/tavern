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
    | 'anti_repeat'
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
        '以自然、简短的中文私聊回复。避免客服话术、标题、项目符号和模板化安慰。历史消息仅用于理解上下文，必须只回应当前用户输入；不得整段回放、改写或拼接历史 assistant 回复。若当前输入未提供事实，不要臆测现实行程、工作安排或共同经历。',
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
    const dedupedHistory = this.dedupeSimilarAssistantHistory(selected);
    const antiRepeatContent = this.buildAntiRepeatConstraint(dedupedHistory);
    const sections: CompanionPromptSection[] = [
      ...systemSections,
      {
        kind: 'history',
        content: dedupedHistory.map((message) => `${message.role}: ${message.content}`).join('\n'),
        included: dedupedHistory.length > 0,
        tokenEstimate: dedupedHistory.reduce(
          (sum, message) => sum + this.estimateTokens(message.content),
          0
        )
      },
      {
        kind: 'anti_repeat',
        content: antiRepeatContent,
        included: Boolean(antiRepeatContent),
        tokenEstimate: this.estimateTokens(antiRepeatContent)
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
        ...dedupedHistory,
        ...(antiRepeatContent ? [{ role: 'system' as const, content: antiRepeatContent }] : []),
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
      historyTrimmed: input.history.length - dedupedHistory.length,
      promptBudget,
      historyBudget
    };
  }
  private estimateTokens(value: string) {
    return value.length ? Math.ceil(value.length / 4) : 0;
  }

  /** 只保留最近两条相似 assistant 开头，避免错误模式被历史持续强化。 */
  private dedupeSimilarAssistantHistory(history: CompanionPromptInput['history']) {
    const keep = new Array<boolean>(history.length).fill(true);
    const prefixCount = new Map<string, number>();

    for (let index = history.length - 1; index >= 0; index -= 1) {
      const message = history[index];

      if (message.role !== 'assistant') continue;
      const prefix = message.content.trim().replace(/\s+/g, '').slice(0, 8).toLowerCase();
      if (!prefix) continue;
      const count = prefixCount.get(prefix) ?? 0;
      prefixCount.set(prefix, count + 1);
      if (count >= 2) keep[index] = false;
    }

    return history.filter((_, index) => keep[index]);
  }

  private buildAntiRepeatConstraint(history: CompanionPromptInput['history']) {
    if (!history.some((message) => message.role === 'assistant' && message.content.trim())) {
      return '';
    }

    return [
      '【本轮反重复约束】',
      '历史 assistant 回复已经发生。只回应最后一条用户消息，不得回放、拼接、改写或续写历史 assistant 的完整段落。',
      '不得复用上一轮或更早回复的开头、措辞、动作、工作安排或生活细节；请从当前输入带来的新变化自然承接。',
      '除非用户明确要求总结，否则不要罗列或复述历史对话。'
    ].join('\n');
  }
}
