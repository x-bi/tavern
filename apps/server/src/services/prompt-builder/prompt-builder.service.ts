import { Injectable } from '@nestjs/common';

import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS,
  PROMPT_BUILDER_DEFAULT_OUTPUT_RULES,
  PROMPT_BUILDER_PLATFORM_RULES
} from './prompt-builder.constants';
import type {
  BuildPromptInput,
  BuildPromptResult,
  ChatMessageLike,
  PromptBuildWarning,
  PromptBuilderMessage,
  PromptInternalMessageRole,
  PromptProviderMessageRole,
  PromptSection,
  PromptSectionKind,
  PromptSectionSource,
  PromptTruncatedHistoryItem,
  ProviderChatMessage,
  WorldBookEntryPosition,
  WorldBookMatchResult
} from './types';
import { matchWorldBookEntries } from './world-book-matcher';

@Injectable()
export class PromptBuilderService {
  build(input: BuildPromptInput): BuildPromptResult {
    const warnings: PromptBuildWarning[] = [];
    const sections: PromptSection[] = [];
    const platformSection = this.addSection(sections, {
      kind: 'platform',
      source: 'system',
      title: 'Platform rules',
      content: PROMPT_BUILDER_PLATFORM_RULES.join('\n')
    });
    const characterSection = this.addSection(sections, {
      kind: 'character',
      source: 'character',
      title: 'Character card',
      content: this.formatCharacter(input.character),
      sourceId: input.character.id
    });
    const personaSection = input.persona
      ? this.addSection(sections, {
          kind: 'persona',
          source: 'persona',
          title: 'User persona',
          content: this.formatTitledBlock(input.persona.name, input.persona.content),
          sourceId: input.persona.id
        })
      : null;
    const presetSection =
      input.promptPreset && this.hasContent(input.promptPreset.systemPrompt)
        ? this.addSection(sections, {
            kind: 'prompt_preset',
            source: 'prompt_preset',
            title: 'Prompt preset',
            content: this.formatTitledBlock(
              input.promptPreset.name,
              input.promptPreset.systemPrompt
            ),
            sourceId: input.promptPreset.id
          })
        : null;
    const outputRulesSection = this.addSection(sections, {
      kind: 'output_rules',
      source: input.promptPreset?.id ? 'prompt_preset' : 'system',
      title: 'Output rules',
      content: this.formatOutputRules(input.promptPreset?.outputRules ?? ''),
      sourceId: input.promptPreset?.id ?? null
    });
    const historyResult = this.selectRecentHistory(
      input.history,
      input.currentUserMessage,
      input,
      warnings
    );
    const worldBook = matchWorldBookEntries({
      worldBooks: input.worldBooks,
      history: input.history,
      currentUserMessage: input.currentUserMessage,
      estimateTokens: (content) => this.estimateTokens(content)
    });
    const worldBookSections = this.createEmptyWorldBookSectionGroups();
    worldBookSections.before_history = this.addWorldBookSections(
      sections,
      worldBook,
      'before_history'
    );
    const historySections = historyResult.history.map((message) =>
      this.addSection(sections, {
        kind: 'history',
        source: 'message',
        title: `History ${message.role}`,
        content: message.content.trim(),
        sourceId: message.id
      })
    );
    worldBookSections.after_history = this.addWorldBookSections(
      sections,
      worldBook,
      'after_history'
    );
    worldBookSections.before_current_user_input = this.addWorldBookSections(
      sections,
      worldBook,
      'before_current_user_input'
    );
    const currentUserSection = this.addSection(sections, {
      kind: 'current_user_input',
      source: 'message',
      title: 'Current user input',
      content: input.currentUserMessage.content.trim(),
      sourceId: input.currentUserMessage.id
    });
    worldBookSections.after_current_user_input = this.addWorldBookSections(
      sections,
      worldBook,
      'after_current_user_input'
    );
    const developerSections = [
      characterSection,
      personaSection,
      presetSection,
      outputRulesSection
    ].filter((section): section is PromptSection => section !== null && section.isIncluded);
    const logicalMessages = this.buildLogicalMessages({
      platformSection,
      developerSections,
      worldBookSections,
      history: historyResult.history,
      historySections,
      currentUserSection
    });
    const finalMessages = this.buildProviderMessages(
      logicalMessages,
      input.options.supportsDeveloperRole ?? false
    );
    return {
      conversationId: input.conversation.id,
      sections,
      logicalMessages,
      finalMessages,
      worldBook,
      truncatedHistory: historyResult.truncatedHistory,
      tokenEstimate: this.estimateTokens(
        finalMessages.map((message) => message.content).join('\n')
      ),
      debug: {
        matchedEntries: worldBook.matchedEntries,
        truncatedHistory: historyResult.truncatedHistory,
        finalMessages,
        sectionOrder: sections.map((section) => section.id),
        warnings
      }
    };
  }

  private buildLogicalMessages(params: {
    platformSection: PromptSection;
    developerSections: PromptSection[];
    worldBookSections: Record<WorldBookEntryPosition, PromptSection[]>;
    history: ChatMessageLike[];
    historySections: PromptSection[];
    currentUserSection: PromptSection;
  }): PromptBuilderMessage[] {
    const messages: PromptBuilderMessage[] = [
      this.toLogicalMessage('system', [params.platformSection])
    ];

    if (params.developerSections.length > 0) {
      messages.push(this.toLogicalMessage('developer', params.developerSections));
    }

    this.pushSectionMessage(messages, 'system', params.worldBookSections.before_history);

    params.history.forEach((message, index) => {
      const role = this.toProviderHistoryRole(message.role);
      const section = params.historySections[index];

      if (role && section) {
        messages.push(this.toLogicalMessage(role, [section]));
      }
    });

    this.pushSectionMessage(messages, 'system', params.worldBookSections.after_history);
    this.pushSectionMessage(messages, 'system', params.worldBookSections.before_current_user_input);

    messages.push(this.toLogicalMessage('user', [params.currentUserSection]));
    this.pushSectionMessage(messages, 'system', params.worldBookSections.after_current_user_input);

    return messages;
  }

  private buildProviderMessages(
    logicalMessages: PromptBuilderMessage[],
    supportsDeveloperRole: boolean
  ): ProviderChatMessage[] {
    if (supportsDeveloperRole) {
      return logicalMessages.map((message) => ({
        role: message.role,
        content: message.content,
        metadata: message.metadata ?? null
      }));
    }

    const finalMessages: ProviderChatMessage[] = [];

    logicalMessages.forEach((message) => {
      if (message.role === 'developer') {
        const previousSystemMessage = finalMessages.find((item) => item.role === 'system');

        if (previousSystemMessage) {
          previousSystemMessage.content = `${previousSystemMessage.content}\n\n${message.content}`;
        } else {
          finalMessages.push({
            role: 'system',
            content: message.content,
            metadata: message.metadata ?? null
          });
        }

        return;
      }

      finalMessages.push({
        role: message.role,
        content: message.content,
        metadata: message.metadata ?? null
      });
    });

    return finalMessages;
  }

  private selectRecentHistory(
    history: ChatMessageLike[],
    currentUserMessage: ChatMessageLike,
    input: BuildPromptInput,
    warnings: PromptBuildWarning[]
  ): { history: ChatMessageLike[]; truncatedHistory: PromptTruncatedHistoryItem[] } {
    const historyLimit = Math.max(
      0,
      input.options.historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT
    );
    const maxHistoryCharacters = Math.max(
      0,
      input.options.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
    );
    const normalizedHistory = history.filter((message) => {
      if (message.id === currentUserMessage.id || !this.hasContent(message.content)) {
        return false;
      }

      const role = this.toProviderHistoryRole(message.role);

      if (!role) {
        warnings.push({
          code: 'PROMPT_HISTORY_ROLE_SKIPPED',
          message: `History message ${message.id} was skipped because role ${message.role} is not supported by Prompt Builder v1.`,
          details: {
            messageId: message.id,
            role: message.role
          }
        });
      }

      return role !== null;
    });
    const countTruncated = normalizedHistory.slice(
      0,
      Math.max(0, normalizedHistory.length - historyLimit)
    );
    const candidates = normalizedHistory.slice(-historyLimit);
    const selected: ChatMessageLike[] = [];
    const characterTruncated: ChatMessageLike[] = [];
    let usedCharacters = 0;

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const message = candidates[index];
      const messageLength = message.content.length;
      const canFit =
        maxHistoryCharacters === 0 || usedCharacters + messageLength <= maxHistoryCharacters;

      if (canFit || selected.length === 0) {
        selected.unshift({
          ...message,
          content: message.content.trim()
        });
        usedCharacters += messageLength;
      } else {
        characterTruncated.unshift(message);
      }
    }

    return {
      history: selected,
      truncatedHistory: [
        ...countTruncated.map((message) => this.toTruncatedHistoryItem(message, 'history_limit')),
        ...characterTruncated.map((message) => this.toTruncatedHistoryItem(message, 'token_budget'))
      ]
    };
  }

  private addSection(
    sections: PromptSection[],
    section: {
      kind: PromptSectionKind;
      source: PromptSectionSource;
      title: string;
      content: string;
      sourceId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): PromptSection {
    const order = sections.length + 1;
    const content = section.content.trim();
    const promptSection = {
      id: `${section.kind}-${order}`,
      kind: section.kind,
      source: section.source,
      title: section.title,
      content,
      isIncluded: this.hasContent(content),
      order,
      tokenEstimate: this.estimateTokens(content),
      sourceId: section.sourceId ?? null,
      reason: section.reason ?? null,
      metadata: section.metadata ?? null
    };

    sections.push(promptSection);

    return promptSection;
  }

  private addWorldBookSections(
    sections: PromptSection[],
    worldBook: WorldBookMatchResult,
    position: WorldBookEntryPosition
  ): PromptSection[] {
    return worldBook.matchedEntries
      .filter((entry) => entry.position === position)
      .map((entry) =>
        this.addSection(sections, {
          kind: 'worldbook',
          source: 'worldbook',
          title: `World book: ${entry.title}`,
          content: entry.content,
          sourceId: entry.entryId,
          reason: `Matched keywords: ${entry.matchedKeywords.join(', ')}`,
          metadata: {
            worldBookId: entry.worldBookId,
            worldBookName: entry.worldBookName,
            entryId: entry.entryId,
            insertionOrder: entry.position,
            priority: entry.priority,
            matchedKeywords: entry.matchedKeywords,
            matchedSecondaryKeywords: entry.matchedSecondaryKeywords ?? [],
            sourceMessageIds: entry.sourceMessageIds
          }
        })
      );
  }

  private createEmptyWorldBookSectionGroups(): Record<WorldBookEntryPosition, PromptSection[]> {
    return {
      before_history: [],
      after_history: [],
      before_current_user_input: [],
      after_current_user_input: []
    };
  }

  private pushSectionMessage(
    messages: PromptBuilderMessage[],
    role: PromptInternalMessageRole,
    sections: PromptSection[]
  ): void {
    const includedSections = sections.filter((section) => section.isIncluded);

    if (includedSections.length === 0) {
      return;
    }

    messages.push(this.toLogicalMessage(role, includedSections));
  }

  private toLogicalMessage(
    role: PromptInternalMessageRole,
    sections: PromptSection[]
  ): PromptBuilderMessage {
    const includedSections = sections.filter((section) => section.isIncluded);
    const content = includedSections
      .map((section) => this.formatSectionForMessage(section))
      .filter((sectionContent) => sectionContent.length > 0)
      .join('\n\n');

    return {
      role,
      content,
      sectionIds: includedSections.map((section) => section.id),
      tokenEstimate: this.estimateTokens(content),
      metadata: {
        sectionKinds: includedSections.map((section) => section.kind)
      }
    };
  }

  private formatCharacter(character: BuildPromptInput['character']): string {
    return [
      this.formatTitledBlock('Name', character.name),
      this.formatTitledBlock('Description', character.description),
      this.formatTitledBlock('Personality', character.personality),
      this.formatTitledBlock('Scenario', character.scenario),
      this.formatTitledBlock('First message', character.firstMessage)
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  private formatOutputRules(outputRules: string): string {
    const rules = [...PROMPT_BUILDER_DEFAULT_OUTPUT_RULES, ...this.splitLines(outputRules)];

    return rules.map((rule) => `- ${rule}`).join('\n');
  }

  private formatSectionForMessage(section: PromptSection): string {
    return `## ${section.title}\n${section.content}`;
  }

  private formatTitledBlock(title: string, content: string): string {
    return this.hasContent(content) ? `${title}: ${content.trim()}` : '';
  }

  private splitLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private toProviderHistoryRole(role: string): PromptProviderMessageRole | null {
    if (role === 'system' || role === 'user' || role === 'assistant') {
      return role;
    }

    return null;
  }

  private toTruncatedHistoryItem(
    message: ChatMessageLike,
    reason: PromptTruncatedHistoryItem['reason']
  ): PromptTruncatedHistoryItem {
    return {
      messageId: message.id,
      role: message.role,
      reason,
      tokenEstimate: this.estimateTokens(message.content)
    };
  }

  private estimateTokens(content: string): number {
    return content.length === 0 ? 0 : Math.ceil(content.length / 4);
  }

  private hasContent(value: string): boolean {
    return value.trim().length > 0;
  }
}
