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

type PromptTemplateVariables = {
  characterName: string;
  userName: string;
};

type RoleplaySegmentKind = 'dialogue' | 'self_action' | 'character_action' | 'narration';

type RoleplaySegment = {
  kind: RoleplaySegmentKind;
  content: string;
};

const ROLEPLAY_SEGMENT_ALIASES: Record<string, RoleplaySegmentKind> = {
  台词: 'dialogue',
  对话: 'dialogue',
  说话: 'dialogue',
  我的动作: 'self_action',
  动作: 'self_action',
  想法: 'self_action',
  心理: 'self_action',
  内心: 'self_action',
  对方动作: 'character_action',
  对面动作: 'character_action',
  对面角色动作: 'character_action',
  角色动作: 'character_action',
  角色状态: 'character_action',
  旁白: 'narration',
  叙述: 'narration',
  场景: 'narration'
};

const ROLEPLAY_SEGMENT_TITLES: Record<RoleplaySegmentKind, string> = {
  dialogue: '用户台词',
  self_action: '用户动作/想法',
  character_action: '对方角色动作/状态',
  narration: '旁白/场景'
};

/**
 * Prompt Builder 服务：把会话上下文组装成发给模型的最终消息序列。
 *
 * 构建流程：
 * 1. 生成各 section（平台规则/角色/人设/预设/输出规则/历史/当前输入/世界书）；
 * 2. 匹配世界书条目（按关键词扫描最近消息）；
 * 3. 裁剪历史（按条数 + 字符上限）；
 * 4. 把 section 组装成逻辑消息（system/developer/user/assistant）；
 * 5. 逻辑消息 → 最终 provider 消息（不支持 developer 角色时合并进 system）。
 */
@Injectable()
export class PromptBuilderService {
  /**
   * 构建 Prompt：组装各 section → 匹配世界书 → 裁剪历史 → 生成最终消息序列。
   *
   * @param input 构建输入（会话/角色/人设/预设/模型配置/历史/当前输入/世界书/选项）。
   * @returns 构建结果（sections、逻辑消息、最终消息、世界书匹配、裁剪历史、调试信息）。
   */
  build(input: BuildPromptInput): BuildPromptResult {
    const warnings: PromptBuildWarning[] = [];
    const sections: PromptSection[] = [];
    const variables = this.createTemplateVariables(input);
    // 平台级固定规则（注入到 system 消息）
    const platformSection = this.addSection(sections, {
      kind: 'platform',
      source: 'system',
      title: 'Platform rules',
      content: PROMPT_BUILDER_PLATFORM_RULES.join('\n')
    });
    // 角色卡（名称/描述/性格/场景/开场白）
    const characterSection = this.addSection(sections, {
      kind: 'character',
      source: 'character',
      title: 'Character card',
      content: this.formatCharacter(input.character, variables),
      sourceId: input.character.id
    });
    // 用户人设（可选）
    const personaSection = input.persona
      ? this.addSection(sections, {
          kind: 'persona',
          source: 'persona',
          title: 'User persona',
          content: this.formatTitledBlock(
            input.persona.name,
            this.resolveTemplateVariables(input.persona.content, variables)
          ),
          sourceId: input.persona.id
        })
      : null;
    // 预设 systemPrompt（可选，有内容才加）
    const presetSection =
      input.promptPreset && this.hasContent(input.promptPreset.systemPrompt)
        ? this.addSection(sections, {
            kind: 'prompt_preset',
            source: 'prompt_preset',
            title: 'Prompt preset',
            content: this.formatTitledBlock(
              input.promptPreset.name,
              this.resolveTemplateVariables(input.promptPreset.systemPrompt, variables)
            ),
            sourceId: input.promptPreset.id
          })
        : null;
    // 输出规则（预设的或默认的）
    const outputRulesSection = this.addSection(sections, {
      kind: 'output_rules',
      source: input.promptPreset?.id ? 'prompt_preset' : 'system',
      title: 'Output rules',
      content: this.formatOutputRules(input.promptPreset?.outputRules ?? '', variables),
      sourceId: input.promptPreset?.id ?? null
    });
    // 裁剪历史（按条数 + 字符上限）
    const historyResult = this.selectRecentHistory(
      input.history,
      input.currentUserMessage,
      input,
      warnings
    );
    // 历史去重：连续多条 assistant 用相似开头时只保留最近 2 条。
    // 同质化历史是模型陷入套话循环的主因——历史里堆 5 条雷同回复，模型会认定这是角色固定语气并复刻。
    const dedupedHistory = this.dedupeSimilarAssistantHistory(historyResult.history, warnings);
    historyResult.history = dedupedHistory;
    // 匹配世界书（扫描最近消息触发关键词）
    const worldBook = matchWorldBookEntries({
      worldBooks: input.worldBooks,
      history: input.history,
      currentUserMessage: input.currentUserMessage,
      estimateTokens: (content) => this.estimateTokens(content)
    });
    const resolvedWorldBook = this.resolveWorldBookVariables(worldBook, variables);
    // 世界书 section 分四组插入（按 position）
    const worldBookSections = this.createEmptyWorldBookSectionGroups();
    worldBookSections.before_history = this.addWorldBookSections(
      sections,
      resolvedWorldBook,
      'before_history'
    );
    // 历史 section（每条消息一个）
    const historySections = historyResult.history.map((message) =>
      this.addSection(sections, {
        kind: 'history',
        source: 'message',
        title: `History ${message.role}`,
        content: this.formatConversationMessageContent(message, variables),
        sourceId: message.id
      })
    );
    worldBookSections.after_history = this.addWorldBookSections(
      sections,
      resolvedWorldBook,
      'after_history'
    );
    worldBookSections.before_current_user_input = this.addWorldBookSections(
      sections,
      resolvedWorldBook,
      'before_current_user_input'
    );
    // 当前用户输入
    const currentUserSection = this.addSection(sections, {
      kind: 'current_user_input',
      source: 'message',
      title: 'Current user input',
      content: this.formatConversationMessageContent(input.currentUserMessage, variables),
      sourceId: input.currentUserMessage.id
    });
    worldBookSections.after_current_user_input = this.addWorldBookSections(
      sections,
      resolvedWorldBook,
      'after_current_user_input'
    );
    // 归类到 developer 角色的 section（角色/人设/预设/输出规则）
    const developerSections = [
      characterSection,
      personaSection,
      presetSection,
      outputRulesSection
    ].filter((section): section is PromptSection => section !== null && section.isIncluded);
    // 组装逻辑消息（system/developer/user/assistant + 世界书插入点）
    const logicalMessages = this.buildLogicalMessages({
      platformSection,
      developerSections,
      worldBookSections,
      history: historyResult.history,
      historySections,
      currentUserSection
    });
    // 逻辑消息 → 最终 provider 消息（不支持 developer 时合并进 system）
    const finalMessages = this.buildProviderMessages(
      logicalMessages,
      input.options.supportsDeveloperRole ?? false
    );
    return {
      conversationId: input.conversation.id,
      sections,
      logicalMessages,
      finalMessages,
      worldBook: resolvedWorldBook,
      truncatedHistory: historyResult.truncatedHistory,
      tokenEstimate: this.estimateTokens(
        finalMessages.map((message) => message.content).join('\n')
      ),
      debug: {
        matchedEntries: resolvedWorldBook.matchedEntries,
        truncatedHistory: historyResult.truncatedHistory,
        finalMessages,
        sectionOrder: sections.map((section) => section.id),
        warnings
      }
    };
  }

  /**
   * 组装逻辑消息：把各 section 按角色和插入点排成消息序列。
   *
   * 顺序：system(平台) → developer(角色/人设/预设/输出规则) →
   * system(世界书 before_history) → 历史消息 → system(世界书 after_history) →
   * system(世界书 before_current_user_input) → user(当前输入) →
   * system(世界书 after_current_user_input)。
   *
   * @param params 各 section 和历史。
   * @returns 逻辑消息数组。
   */
  private buildLogicalMessages(params: {
    platformSection: PromptSection;
    developerSections: PromptSection[];
    worldBookSections: Record<WorldBookEntryPosition, PromptSection[]>;
    history: ChatMessageLike[];
    historySections: PromptSection[];
    currentUserSection: PromptSection;
  }): PromptBuilderMessage[] {
    // 1. 平台规则放第一条 system 消息
    const messages: PromptBuilderMessage[] = [
      this.toLogicalMessage('system', [params.platformSection])
    ];

    // 2. developer 消息：角色/人设/预设/输出规则聚合成一条（有内容才加）
    if (params.developerSections.length > 0) {
      messages.push(this.toLogicalMessage('developer', params.developerSections));
    }

    // 3. 世界书 before_history 插入点（作为 system 消息）
    this.pushSectionMessage(messages, 'system', params.worldBookSections.before_history);

    // 4. 历史消息：每条按角色转成对应消息（user/assistant/system）
    params.history.forEach((message, index) => {
      const role = this.toProviderHistoryRole(message.role);
      const section = params.historySections[index];

      if (role && section) {
        messages.push(this.toLogicalMessage(role, [section]));
      }
    });

    // 5. 世界书 after_history / before_current_user_input 插入点
    this.pushSectionMessage(messages, 'system', params.worldBookSections.after_history);
    this.pushSectionMessage(messages, 'system', params.worldBookSections.before_current_user_input);

    // 6. 动态反重复提示：提取最近一条 assistant 回复的开头，明确禁止本轮复用相同/相近开头或句式。
    //    这是针对"模型每轮复刻同一开头"最直接的约束——告诉模型上轮以 X 开头，本轮禁止雷同。
    this.pushAntiRepeatMessage(messages, params.history);

    // 7. 当前用户输入（user 消息）
    messages.push(this.toLogicalMessage('user', [params.currentUserSection]));
    // 8. 世界书 after_current_user_input 插入点
    this.pushSectionMessage(messages, 'system', params.worldBookSections.after_current_user_input);

    return messages;
  }

  /**
   * 构造并推入动态反重复 system 消息。
   *
   * 不把上一轮原文片段写入提示，避免模型把被禁止文本当成可模仿样本。
   * 只给出结构性约束：承认上一轮已发生，并要求从新动作或新观察切入。
   *
   * @param messages 逻辑消息数组（就地推入）。
   * @param history 裁剪后的历史消息（正序，最后一条为最近）。
   */
  private pushAntiRepeatMessage(
    messages: PromptBuilderMessage[],
    history: ChatMessageLike[]
  ): void {
    // 从后往前找最近一条 assistant 历史回复
    let lastAssistant: ChatMessageLike | null = null;

    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].role === 'assistant' && this.hasContent(history[index].content)) {
        lastAssistant = history[index];

        break;
      }
    }

    if (!lastAssistant) {
      return;
    }

    const content = [
      '【本轮反重复约束】',
      '上一轮 assistant 回复已经发生，本轮不得重写、续写同一个开头段落，或复述上一轮已表达过的动作、台词和旁白结构。',
      '请从当前用户输入造成的新变化切入，只保留必要承接；优先写新的动作、观察、决策、位置变化或关系推进。',
      '除非用户明确要求总结，否则不要回放完整历史，不要把其他未在当前场景行动的角色逐个点名。'
    ].join('\n');

    messages.push({
      role: 'system',
      content,
      sectionIds: [],
      tokenEstimate: this.estimateTokens(content),
      metadata: {
        sectionKinds: ['anti_repeat'],
        antiRepeat: {
          sourceMessageId: lastAssistant.id
        }
      }
    });
  }

  /**
   * 逻辑消息 → 最终 provider 消息。
   *
   * 支持 developer 角色：原样保留 developer 消息；
   * 不支持：把 developer 消息合并进第一条 system 消息（没有 system 则新建）。
   *
   * @param logicalMessages 逻辑消息。
   * @param supportsDeveloperRole 模型是否支持 developer 角色。
   * @returns 最终 provider 消息数组。
   */
  private buildProviderMessages(
    logicalMessages: PromptBuilderMessage[],
    supportsDeveloperRole: boolean
  ): ProviderChatMessage[] {
    // 支持 developer 角色：逻辑消息原样转 provider 消息
    if (supportsDeveloperRole) {
      return logicalMessages.map((message) => ({
        role: message.role,
        content: message.content,
        metadata: message.metadata ?? null
      }));
    }

    // 不支持 developer：把 developer 消息合并进 system（前面没有 system 则新建一条）
    const finalMessages: ProviderChatMessage[] = [];

    logicalMessages.forEach((message) => {
      if (message.role === 'developer') {
        // 找已有的第一条 system 消息，把 developer 内容追加进去
        const previousSystemMessage = finalMessages.find((item) => item.role === 'system');

        if (previousSystemMessage) {
          previousSystemMessage.content = `${previousSystemMessage.content}\n\n${message.content}`;
        } else {
          // 没有 system：把 developer 降级成 system 消息
          finalMessages.push({
            role: 'system',
            content: message.content,
            metadata: message.metadata ?? null
          });
        }

        return;
      }

      // 非 developer 消息原样加入
      finalMessages.push({
        role: message.role,
        content: message.content,
        metadata: message.metadata ?? null
      });
    });

    return finalMessages;
  }

  /**
   * 裁剪历史：按条数上限 + 字符上限选出最近的历史消息。
   *
   * 流程：过滤无效消息（当前消息/空内容/不支持的角色）→ 按条数取最近 N 条 →
   * 从最新往最旧套用字符预算，超预算的裁剪（但至少保留最新一条）。
   *
   * @param history 原始历史。
   * @param currentUserMessage 当前消息（从历史中排除）。
   * @param input 构建输入（取限制参数）。
   * @param warnings 警告收集（不支持的角色会告警）。
   * @returns 选中的历史 + 被裁剪的（区分条数限制/字符预算两种原因）。
   */
  private selectRecentHistory(
    history: ChatMessageLike[],
    currentUserMessage: ChatMessageLike,
    input: BuildPromptInput,
    warnings: PromptBuildWarning[]
  ): { history: ChatMessageLike[]; truncatedHistory: PromptTruncatedHistoryItem[] } {
    // 限制参数兜底
    const historyLimit = Math.max(
      0,
      input.options.historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT
    );
    const maxHistoryCharacters = Math.max(
      0,
      input.options.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
    );
    // 第一重过滤：排除当前消息、空内容、不支持的角色（不支持的角色会告警）
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
    // 第二重裁剪-条数：超出 historyLimit 的（最旧的）记为 countTruncated
    const countTruncated = normalizedHistory.slice(
      0,
      Math.max(0, normalizedHistory.length - historyLimit)
    );
    // 取最近 historyLimit 条作为候选
    const candidates = normalizedHistory.slice(-historyLimit);
    const selected: ChatMessageLike[] = [];
    const characterTruncated: ChatMessageLike[] = [];
    let usedCharacters = 0;

    // 第二重裁剪-字符：从最新往最旧套用字符预算，超预算的裁剪（但至少保留最新一条）
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const message = candidates[index];
      const messageLength = message.content.length;
      const canFit =
        maxHistoryCharacters === 0 || usedCharacters + messageLength <= maxHistoryCharacters;

      // 能放下，或至少要保留最新一条（selected 为空时强制保留）
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
      // 裁剪项分两类：条数超限（最旧的）/ 字符超限（套预算时放不下的）
      truncatedHistory: [
        ...countTruncated.map((message) => this.toTruncatedHistoryItem(message, 'history_limit')),
        ...characterTruncated.map((message) => this.toTruncatedHistoryItem(message, 'token_budget'))
      ]
    };
  }

  /**
   * 去重连续相似开头的 assistant 历史：只保留最近 2 条相似回复，更早的移除。
   *
   * 同质化 assistant 历史是模型陷入套话循环的主因。当历史里连续多条 assistant 回复
   * 用相似开头（如都以"纱织微微一笑，眼中闪过一丝温柔的光芒"起笔），模型会把它当成
   * 角色固定语气复刻。保留最近 2 条足够提供角色语气样例，更早的雷同回复只会强化模仿。
   *
   * user 消息一律保留（保上下文/剧情推进）；只移除 assistant，并在 warnings 里记录移除计数。
   *
   * @param history 裁剪后的历史（正序，会被原地替换为新数组）。
   * @param warnings 警告收集。
   * @returns 去重后的历史（新数组）。
   */
  private dedupeSimilarAssistantHistory(
    history: ChatMessageLike[],
    warnings: PromptBuildWarning[]
  ): ChatMessageLike[] {
    const SIMILAR_PREFIX_LENGTH = 12; // 开头比较长度（字符）
    const MAX_SIMILAR_KEEP = 2; // 连续相似 assistant 最多保留条数

    // 收集 assistant 消息及其开头前缀
    const assistantEntries = history
      .map((message, index) => ({
        index,
        message,
        prefix: this.normalizePrefixForCompare(message.content, SIMILAR_PREFIX_LENGTH)
      }))
      .filter((entry) => entry.message.role === 'assistant' && entry.prefix.length > 0);

    if (assistantEntries.length <= MAX_SIMILAR_KEEP) {
      return history;
    }

    // 从后往前聚类：连续 prefix 相同的 assistant 归为一组，每组只保留最近 MAX_SIMILAR_KEEP 条
    const removeIndices = new Set<number>();
    let groupStart = assistantEntries.length; // 当前相似组的起始下标（assistantEntries 内）

    for (let i = assistantEntries.length - 1; i >= 0; i -= 1) {
      const current = assistantEntries[i];
      const next = assistantEntries[i + 1];

      // 与下一条（更晚的）prefix 不同 → 开启新组
      if (!next || next.prefix !== current.prefix) {
        groupStart = i + 1;
      }

      // 当前组大小 = groupStart - i（含当前）
      const groupSize = groupStart - i;

      // 超出保留数的更早条目标记移除
      if (groupSize > MAX_SIMILAR_KEEP) {
        removeIndices.add(current.index);
      }
    }

    if (removeIndices.size === 0) {
      return history;
    }

    warnings.push({
      code: 'PROMPT_HISTORY_SIMILAR_DEDUPLICATED',
      message: `Removed ${removeIndices.size} consecutive assistant history message(s) with similar openings to break repetition loops.`,
      details: {
        removedCount: removeIndices.size,
        prefixLength: SIMILAR_PREFIX_LENGTH,
        keptMax: MAX_SIMILAR_KEEP
      }
    });

    return history.filter((_, index) => !removeIndices.has(index));
  }

  /**
   * 归一化消息开头用于相似度比较：去空白/模板变量后取前 N 字。
   * @param content 消息内容。
   * @param length 比较长度。
   * @returns 归一化后的前缀（小写、无空白）。
   */
  private normalizePrefixForCompare(content: string, length: number): string {
    return content
      .trim()
      .replace(/\s+/g, '')
      .slice(0, length)
      .toLowerCase();
  }

  /**
   * 创建并追加一个 section 到 sections 数组。
   * @param sections 目标数组。
   * @param section section 描述（kind/source/title/content 等）。
   * @returns 创建的 section（含自动计算的 order、tokenEstimate、isIncluded）。
   */
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

  /**
   * 把指定位置的世界书命中条目转成 section 并追加。
   * @param sections 目标数组。
   * @param worldBook 世界书匹配结果。
   * @param position 插入位置。
   * @returns 创建的 section 数组。
   */
  private addWorldBookSections(
    sections: PromptSection[],
    worldBook: WorldBookMatchResult,
    position: WorldBookEntryPosition
  ): PromptSection[] {
    // 筛出该插入位置的命中条目，逐个转成 section
    return worldBook.matchedEntries
      .filter((entry) => entry.position === position)
      .map((entry) =>
        this.addSection(sections, {
          kind: 'worldbook',
          source: 'worldbook',
          title: `World book: ${entry.title}`,
          content: entry.content,
          sourceId: entry.entryId,
          // 记录命中的关键词（调试用）
          reason: `Matched keywords: ${entry.matchedKeywords.join(', ')}`,
          // metadata 记录世界书/条目/命中关键词/来源消息等调试信息
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

  /** 创建空的世界书 section 分组（四个插入位置各一个空数组）。 */
  private createEmptyWorldBookSectionGroups(): Record<WorldBookEntryPosition, PromptSection[]> {
    return {
      before_history: [],
      after_history: [],
      before_current_user_input: [],
      after_current_user_input: []
    };
  }

  /**
   * 把一组 section 作为一条消息推入消息数组（无 included section 则跳过）。
   * @param messages 消息数组。
   * @param role 消息角色。
   * @param sections section 数组。
   */
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

  /**
   * 把多个 section 聚合成一条逻辑消息（拼接内容、收集 id、估算 token）。
   * @param role 消息角色。
   * @param sections 参与的 section。
   * @returns 逻辑消息。
   */
  private toLogicalMessage(
    role: PromptInternalMessageRole,
    sections: PromptSection[]
  ): PromptBuilderMessage {
    // 只取纳入的 section
    const includedSections = sections.filter((section) => section.isIncluded);
    // 多个 section 内容用空行拼接成一条消息
    const content = includedSections
      .map((section) => this.formatSectionForMessage(section))
      .filter((sectionContent) => sectionContent.length > 0)
      .join('\n\n');

    return {
      role,
      content,
      sectionIds: includedSections.map((section) => section.id),
      tokenEstimate: this.estimateTokens(content),
      // metadata 记录本消息含哪些 section kind（调试用）
      metadata: {
        sectionKinds: includedSections.map((section) => section.kind)
      }
    };
  }

  /**
   * 格式化角色卡为文本（名称/描述/性格/场景/开场白）。
   * @param character 角色上下文。
   * @returns 格式化后的文本。
   */
  private formatCharacter(
    character: BuildPromptInput['character'],
    variables: PromptTemplateVariables
  ): string {
    return [
      this.formatTitledBlock('Name', character.name),
      this.formatTitledBlock(
        'Description',
        this.resolveTemplateVariables(character.description, variables)
      ),
      this.formatTitledBlock(
        'Personality',
        this.resolveTemplateVariables(character.personality, variables)
      ),
      this.formatTitledBlock(
        'Scenario',
        this.resolveTemplateVariables(character.scenario, variables)
      ),
      this.formatTitledBlock(
        'First message',
        this.resolveTemplateVariables(character.firstMessage, variables)
      )
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  /**
   * 格式化输出规则：默认规则 + 预设规则，每条前加 `- `。
   * @param outputRules 预设的输出规则文本。
   * @returns 格式化后的规则文本。
   */
  private formatOutputRules(outputRules: string, variables: PromptTemplateVariables): string {
    const rules = [
      ...PROMPT_BUILDER_DEFAULT_OUTPUT_RULES,
      ...this.splitLines(this.resolveTemplateVariables(outputRules, variables))
    ];

    return rules.map((rule) => `- ${rule}`).join('\n');
  }

  /**
   * 格式化对话消息内容。
   *
   * 用户消息可使用行首段落标记，例如 `[台词]`、`[我的动作]`、`[对方动作]`、`[旁白]`。
   * 只有显式标记时才转换成结构化块；普通消息保持原始纯文本形态，避免影响既有对话。
   *
   * @param message 历史或当前消息。
   * @param variables Prompt 模板变量。
   * @returns 发给模型的消息内容。
   */
  private formatConversationMessageContent(
    message: ChatMessageLike,
    variables: PromptTemplateVariables
  ): string {
    const content = this.resolveTemplateVariables(message.content, variables);

    if (message.role !== 'user') {
      return content;
    }

    const segments = this.parseRoleplaySegments(content);

    if (!segments || segments.length === 0) {
      return content;
    }

    return [
      '用户输入包含分段标记。请按下面标签理解每段含义，不要把标签原样复述：',
      ...segments.map((segment) =>
        this.formatTitledBlock(ROLEPLAY_SEGMENT_TITLES[segment.kind], segment.content)
      )
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  /**
   * 解析行首角色扮演段落标记。
   *
   * 标记行格式：`[台词] 内容`。未带新标记的后续行会追加到上一段；
   * 第一段之前的未标记文本按用户台词处理，避免误删输入。
   *
   * @param content 用户消息内容。
   * @returns 解析出的段落；没有任何显式标记时返回 null。
   */
  private parseRoleplaySegments(content: string): RoleplaySegment[] | null {
    const lines = content.split(/\r?\n/);
    const segments: RoleplaySegment[] = [];
    let currentSegment: RoleplaySegment | null = null;
    let hasExplicitMarker = false;

    lines.forEach((line) => {
      const marker = this.parseRoleplayMarker(line);

      if (marker) {
        hasExplicitMarker = true;
        currentSegment = {
          kind: marker.kind,
          content: marker.content
        };
        segments.push(currentSegment);

        return;
      }

      if (!currentSegment) {
        currentSegment = {
          kind: 'dialogue',
          content: line
        };
        segments.push(currentSegment);

        return;
      }

      currentSegment.content = `${currentSegment.content}\n${line}`;
    });

    if (!hasExplicitMarker) {
      return null;
    }

    return segments
      .map((segment) => ({
        ...segment,
        content: segment.content.trim()
      }))
      .filter((segment) => segment.content.length > 0);
  }

  /**
   * 解析单行是否以角色扮演标记开头。
   * @param line 原始行。
   * @returns 标记种类和行内内容；不是标记行时返回 null。
   */
  private parseRoleplayMarker(line: string): RoleplaySegment | null {
    const match = line.match(/^\s*\[([^\]]{1,12})\]\s*(.*)$/u);

    if (!match) {
      return null;
    }

    const kind = ROLEPLAY_SEGMENT_ALIASES[match[1].trim()];

    if (!kind) {
      return null;
    }

    return {
      kind,
      content: match[2]
    };
  }

  /**
   * 把 section 格式化成消息内的一段。
   *
   * 对话类 section（history / current_user_input）返回纯内容，不加标题：
   * 历史消息必须保持纯净的 role+content 形态，否则给每条历史都顶一个 `## History assistant`
   * 标题会让模型把"标题+该内容"当成既定写作风格去模仿，长会话下加剧同质化重复。
   * 设定类 section（角色卡/人设/预设/输出规则/世界书/平台规则）仍带标题便于区分。
   */
  private formatSectionForMessage(section: PromptSection): string {
    if (section.kind === 'history' || section.kind === 'current_user_input') {
      return section.content;
    }

    return `## ${section.title}\n${section.content}`;
  }

  /** 格式化标题块（`标题: 内容`），内容为空返回空串。 */
  private formatTitledBlock(title: string, content: string): string {
    return this.hasContent(content) ? `${title}: ${content.trim()}` : '';
  }

  /**
   * 创建 Prompt 变量上下文。
   * @param input Prompt 构建输入。
   * @returns 可用于替换 `{{char}}`、`{{user}}` 等模板变量的值。
   */
  private createTemplateVariables(input: BuildPromptInput): PromptTemplateVariables {
    return {
      characterName: input.character.name.trim() || 'Assistant',
      userName: input.persona?.name.trim() || 'User'
    };
  }

  /**
   * 替换进入 Prompt 的常见酒馆模板变量。
   * @param value 原始文本。
   * @param variables 模板变量上下文。
   * @returns 替换后的文本。
   */
  private resolveTemplateVariables(value: string, variables: PromptTemplateVariables): string {
    return value
      .replace(/\{\{\s*(char|character|bot|assistant|char_name)\s*\}\}/gi, variables.characterName)
      .replace(/\{\{\s*(user|persona|user_name)\s*\}\}/gi, variables.userName)
      .replace(/<BOT>/gi, variables.characterName)
      .replace(/<USER>/gi, variables.userName)
      .trim();
  }

  /**
   * 替换世界书命中内容中的模板变量，并同步更新命中 token 估算。
   * @param worldBook 世界书匹配结果。
   * @param variables 模板变量上下文。
   * @returns 替换后的世界书匹配结果。
   */
  private resolveWorldBookVariables(
    worldBook: WorldBookMatchResult,
    variables: PromptTemplateVariables
  ): WorldBookMatchResult {
    let usedTokenEstimate = 0;
    const matchedEntries = worldBook.matchedEntries.map((entry) => {
      const content = this.resolveTemplateVariables(entry.content, variables);
      const tokenEstimate = this.estimateTokens(content);
      usedTokenEstimate += tokenEstimate;

      return {
        ...entry,
        content,
        tokenEstimate
      };
    });

    return {
      ...worldBook,
      matchedEntries,
      usedTokenEstimate
    };
  }

  /** 按行拆分文本，trim 并过滤空行。 */
  private splitLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * 把历史消息角色归一化为 provider 角色（仅 system/user/assistant）。
   * @param role 原始角色。
   * @returns 合法的 provider 角色，不支持的返回 null。
   */
  private toProviderHistoryRole(role: string): PromptProviderMessageRole | null {
    if (role === 'system' || role === 'user' || role === 'assistant') {
      return role;
    }

    return null;
  }

  /**
   * 构造被裁剪的历史消息项。
   * @param message 被裁剪的消息。
   * @param reason 裁剪原因。
   * @returns 裁剪项。
   */
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

  /** 粗略估算 token 数（每 4 字符约 1 token）。 */
  private estimateTokens(content: string): number {
    return content.length === 0 ? 0 : Math.ceil(content.length / 4);
  }

  /** 内容是否非空（trim 后有字符）。 */
  private hasContent(value: string): boolean {
    return value.trim().length > 0;
  }
}
