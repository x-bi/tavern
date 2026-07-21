import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Character, Conversation, Message, PromptPreset, UserPersona } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptBuilderService } from '../../services/prompt-builder/prompt-builder.service';
import { resolveModelPromptBudget } from '../../services/prompt-builder/prompt-budget';
import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
} from '../../services/prompt-builder/prompt-builder.constants';
import type {
  BuildPromptInput,
  ChatMessageLike,
  PromptHistoryTrimInfo,
  PromptModelParameters,
  PromptPreviewWorldBookDebug,
  PromptPreviewResponse,
  PromptSection,
  WorldBookEntryPosition,
  WorldBookContext
} from '../../services/prompt-builder/types';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig } from '../models/model.types';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUser } from '../users/user.types';
import { WorldBooksService } from '../world-books/world-books.service';
import type { PreviewPromptDto } from './dto/preview-prompt.dto';

/** 预览会话（含关联的角色/预设/人设）。 */
type PreviewConversation = Conversation & {
  character: Character;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

/**
 * Prompt 预览服务：组装会话上下文，调用 PromptBuilder 生成最终 prompt。
 *
 * 主要用于调试：展示最终发给模型的各 section、历史裁剪情况、世界书匹配情况。
 */
@Injectable()
export class PromptsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PromptBuilderService)
    private readonly promptBuilder: PromptBuilderService,
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService,
    @Inject(ModelsService)
    private readonly modelsService: ModelsService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 预览生成的 prompt。
   *
   * 流程：取会话 → 取世界书上下文 → 取历史消息 → 组装构建输入 →
   * 调用 promptBuilder 构建 → 提取历史裁剪和世界书调试信息 → 返回预览。
   *
   * @param currentUser 当前登录用户。
   * @param dto 预览入参。
   * @returns 预览响应（含 sections、历史裁剪、世界书调试信息）。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  async preview(currentUser: CurrentUser, dto: PreviewPromptDto): Promise<PromptPreviewResponse> {
    // 取会话（含关联实体）
    const conversation = await this.findOwnedActiveConversation(currentUser, dto.conversationId);
    const modelCandidates = await this.modelsService.getGatewayCandidates({
      currentUser,
      modelFallbackGroupId: conversation.modelFallbackGroupId
    });
    const gatewayConfig = modelCandidates[0] ?? null;
    // 取角色关联的世界书上下文（用于关键词扫描插入）
    const worldBooks = await this.worldBooksService.listPromptContexts(
      currentUser,
      conversation.characterId
    );
    // 取最近消息，条数取 historyLimit 和世界书扫描深度的较大值（确保扫描到足够历史）
    const history = await this.listRecentMessages(
      conversation.id,
      this.resolveHistoryTake(dto.historyLimit, worldBooks)
    );
    // 组装 prompt 构建输入（会话/角色/人设/预设/模型配置/历史/当前输入/世界书/选项）
    const buildInput = this.toBuildPromptInput(
      currentUser,
      conversation,
      history,
      dto,
      worldBooks,
      gatewayConfig
    );
    // 构建 prompt（promptBuilder 内部组装各 section、裁剪历史、匹配世界书）
    const result = this.promptBuilder.build(buildInput);
    // 提取历史裁剪信息和世界书调试信息
    const historyTrimInfo = this.toHistoryTrimInfo(dto, history.length, result);
    const worldBookDebug = this.toWorldBookDebug(result);

    return {
      conversationId: result.conversationId,
      generatedAt: new Date().toISOString(),
      sections: result.sections,
      logicalMessages: result.logicalMessages,
      finalMessages: result.finalMessages,
      worldBook: result.worldBook,
      worldBookDebug,
      historyTrimInfo,
      tokenEstimate: result.tokenEstimate,
      debug: {
        ...result.debug,
        finalMessages: result.finalMessages,
        truncatedHistory: historyTrimInfo.truncatedHistory
      }
    };
  }

  /**
   * 查询会话并校验所有权（含关联实体）。
   * @param currentUser 当前登录用户。
   * @param conversationId 会话 ID。
   * @returns 会话记录（含关联）。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  private async findOwnedActiveConversation(
    currentUser: CurrentUser,
    conversationId: string
  ): Promise<PreviewConversation> {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: currentUser.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { usesSensitiveResource: false })
      },
      include: {
        character: true,
        promptPreset: true,
        persona: true
      }
    });

    if (!conversation) {
      throw new NotFoundException({
        code: ERROR_CODES.CONVERSATION_NOT_FOUND,
        message: 'Conversation not found.'
      });
    }

    return conversation;
  }

  /**
   * 取会话最近的消息（倒序取 N 条再反转为正序）。
   * @param conversationId 会话 ID。
   * @param historyLimit 最多取多少条，限制在 1~100。
   * @returns 正序的历史消息数组。
   */
  private async listRecentMessages(
    conversationId: string,
    historyLimit: number | undefined
  ): Promise<Message[]> {
    // 限制条数在 1~100，未传用默认值
    const take = Math.max(1, Math.min(historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT, 100));
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        status: {
          not: 'deleted'
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take
    });

    // 数据库倒序取（最新在前），反转成正序（最早在前）便于按对话顺序构建
    return messages.reverse();
  }

  /**
   * 把会话及关联实体组装成 PromptBuilder 的输入结构。
   *
   * 含：会话元数据、角色、人设、预设、模型配置、历史消息、当前用户输入、世界书、构建选项。
   * @param params 组装所需各参数。
   * @returns PromptBuilder 构建输入。
   */
  private toBuildPromptInput(
    currentUser: CurrentUser,
    conversation: PreviewConversation,
    history: Message[],
    dto: PreviewPromptDto,
    worldBooks: WorldBookContext[],
    gatewayConfig: ModelGatewayConfig | null
  ): BuildPromptInput {
    const presetParameters = conversation.promptPreset
      ? this.parseParams(conversation.promptPreset.parametersJson)
      : null;

    return {
      userId: currentUser.id,
      conversation: {
        id: conversation.id,
        userId: conversation.userId,
        characterId: conversation.characterId,
        title: conversation.title,
        metadata: this.parseRecord(conversation.metadataJson)
      },
      character: {
        id: conversation.character.id,
        name: conversation.character.name,
        description: conversation.character.description,
        personality: conversation.character.personality,
        scenario: conversation.character.scenario,
        firstMessage: conversation.character.firstMessage,
        // 示例对话从 JSON 解析成结构化消息
        exampleMessages: this.parseExampleMessages(
          conversation.character.exampleMessagesJson,
          conversation.id
        ),
        metadata: this.parseRecord(conversation.character.metadataJson)
      },
      persona: conversation.persona
        ? {
            id: conversation.persona.id,
            name: conversation.persona.name,
            content: conversation.persona.content,
            metadata: this.parseRecord(conversation.persona.metadataJson)
          }
        : null,
      promptPreset: conversation.promptPreset
        ? {
            id: conversation.promptPreset.id,
            name: conversation.promptPreset.name,
            description: conversation.promptPreset.description,
            systemPrompt: conversation.promptPreset.systemPrompt,
            outputRules: conversation.promptPreset.outputRules,
            parameters: presetParameters,
            metadata: this.parseRecord(conversation.promptPreset.metadataJson)
          }
        : null,
      modelGateway: gatewayConfig
        ? {
            id: gatewayConfig.providerModelId ?? '',
            name: gatewayConfig.displayName ?? gatewayConfig.modelName,
            providerName: gatewayConfig.providerName,
            baseUrl: gatewayConfig.baseUrl,
            modelName: gatewayConfig.modelName,
            parameters: gatewayConfig.params,
            metadata: null
          }
        : null,
      history: history.map((message) => this.toChatMessageLike(message)),
      // 当前用户输入作为预览的"新消息"（id 标记为 preview 避免与真实消息混淆）
      currentUserMessage: {
        id: 'preview-current-user-input',
        conversationId: conversation.id,
        role: 'user',
        content: dto.userInput,
        status: 'preview',
        metadata: null,
        tokenCount: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      worldBooks,
      options: {
        mode: 'preview',
        historyLimit: dto.historyLimit,
        maxHistoryCharacters: dto.maxHistoryCharacters,
        maxPromptTokens: resolveModelPromptBudget(gatewayConfig, presetParameters?.maxTokens),
        includeDebug: true,
        supportsDeveloperRole: dto.supportsDeveloperRole
      }
    };
  }

  /**
   * 提取历史裁剪信息：请求的限制 vs 实际使用的条数 vs 被裁剪的条数。
   * @param dto 预览入参。
   * @param availableHistoryCount 可用历史条数。
   * @param result PromptBuilder 构建结果。
   * @returns 历史裁剪信息。
   */
  private toHistoryTrimInfo(
    dto: PreviewPromptDto,
    availableHistoryCount: number,
    result: ReturnType<PromptBuilderService['build']>
  ): PromptHistoryTrimInfo {
    // 实际纳入 history section 的条数
    const usedHistoryCount = result.sections.filter(
      (section) => section.kind === 'history' && section.isIncluded
    ).length;

    return {
      requestedHistoryLimit: dto.historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
      requestedMaxHistoryCharacters:
        dto.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS,
      availableHistoryCount,
      usedHistoryCount,
      truncatedCount: result.truncatedHistory.length,
      truncatedHistory: result.truncatedHistory
    };
  }

  /**
   * 提取世界书调试信息：扫描深度、匹配/跳过的条目、实际插入的 section。
   * @param result PromptBuilder 构建结果。
   * @returns 世界书调试信息。
   */
  private toWorldBookDebug(
    result: ReturnType<PromptBuilderService['build']>
  ): PromptPreviewWorldBookDebug {
    return {
      scanDepth: result.worldBook.scanDepth,
      tokenBudget: result.worldBook.tokenBudget,
      usedTokenEstimate: result.worldBook.usedTokenEstimate,
      scannedMessageIds: result.worldBook.scannedMessageIds,
      matchedCount: result.worldBook.matchedEntries.length,
      skippedCount: result.worldBook.skippedEntries.length,
      matchedEntries: result.worldBook.matchedEntries,
      skippedEntries: result.worldBook.skippedEntries,
      insertedSections: result.sections
        .filter((section) => section.kind === 'worldbook' && section.isIncluded)
        .map((section) => this.toWorldBookInsertedSection(section))
    };
  }

  /**
   * 把 worldbook section 转成插入调试信息（含插入位置、顺序、token 估算）。
   * @param section worldbook section。
   * @returns 插入调试信息。
   */
  private toWorldBookInsertedSection(
    section: PromptSection
  ): PromptPreviewWorldBookDebug['insertedSections'][number] {
    const metadata = this.isRecord(section.metadata) ? section.metadata : {};
    const insertionOrder = this.toWorldBookInsertionOrder(metadata.insertionOrder);

    return {
      sectionId: section.id,
      entryId: typeof metadata.entryId === 'string' ? metadata.entryId : (section.sourceId ?? null),
      title: section.title,
      insertionOrder,
      order: section.order,
      tokenEstimate: section.tokenEstimate
    };
  }

  /**
   * 校验并归一化世界书条目的插入位置；非法值返回 null。
   * @param value 原始插入位置值。
   * @returns 合法的插入位置，或 null。
   */
  private toWorldBookInsertionOrder(value: unknown): WorldBookEntryPosition | null {
    if (
      value === 'before_history' ||
      value === 'after_history' ||
      value === 'before_current_user_input' ||
      value === 'after_current_user_input'
    ) {
      return value;
    }

    return null;
  }

  /**
   * 决定取多少条历史消息：取 historyLimit 和世界书扫描深度的较大值。
   *
   * 因为世界书扫描需要扫描最近 N 条消息触发关键词，历史取得太少会导致世界书匹配不全。
   * @param historyLimit 请求的历史条数限制。
   * @param worldBooks 世界书上下文列表。
   * @returns 实际取的历史条数。
   */
  private resolveHistoryTake(
    historyLimit: number | undefined,
    worldBooks: WorldBookContext[]
  ): number {
    const promptHistoryLimit = historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT;
    // 取所有启用世界书中最大的扫描深度
    const worldBookScanDepth = worldBooks.reduce(
      (maxDepth, worldBook) =>
        worldBook.isEnabled ? Math.max(maxDepth, worldBook.scanDepth) : maxDepth,
      0
    );

    // 取两者较大值，确保世界书能扫描到足够消息
    return Math.max(promptHistoryLimit, worldBookScanDepth);
  }

  /**
   * 数据库消息 → ChatMessageLike（PromptBuilder 用的消息形态）。
   * @param message 消息数据库记录。
   * @returns ChatMessageLike。
   */
  private toChatMessageLike(message: Message): ChatMessageLike {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      metadata: this.parseRecord(message.metadataJson),
      tokenCount: message.tokenCount,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };
  }

  /**
   * 解析角色的示例对话 JSON 为消息数组。
   * 校验每项必须有 role/content 字符串，不合法的过滤掉。
   * @param value exampleMessagesJson 字符串。
   * @param conversationId 会话 ID（用于生成标记 id）。
   * @returns 解析后的消息数组。
   */
  private parseExampleMessages(value: string | null, conversationId: string): ChatMessageLike[] {
    const parsed = this.parseJson(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    // 过滤出结构合法的项（role/content 都是字符串）
    return parsed
      .filter((item): item is { role: string; content: string } => {
        return (
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          'content' in item &&
          typeof item.role === 'string' &&
          typeof item.content === 'string'
        );
      })
      .map((item, index) => ({
        // 示例消息没有真实 id，用序号生成标记 id
        id: `character-example-${index + 1}`,
        conversationId,
        role: item.role,
        content: item.content,
        status: 'example',
        metadata: null,
        tokenCount: null
      }));
  }

  /**
   * 解析参数 JSON；非对象返回 null，只保留合法数值字段。
   * @param value 参数 JSON 字符串。
   * @returns 解析后的参数对象，或 null。
   */
  private parseParams(value: string | null): PromptModelParameters | null {
    const parsed = this.parseJson(value);

    if (!this.isRecord(parsed)) {
      return null;
    }

    return {
      ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
      ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
      ...(typeof parsed.maxTokens === 'number' && Number.isInteger(parsed.maxTokens)
        ? { maxTokens: parsed.maxTokens }
        : {}),
      ...(typeof parsed.timeout === 'number' && Number.isInteger(parsed.timeout)
        ? { timeout: parsed.timeout }
        : {}),
      ...(typeof parsed.frequencyPenalty === 'number'
        ? { frequencyPenalty: parsed.frequencyPenalty }
        : {}),
      ...(typeof parsed.presencePenalty === 'number'
        ? { presencePenalty: parsed.presencePenalty }
        : {})
    };
  }

  /**
   * 解析 JSON 为对象；非对象/解析失败返回 null。
   * @param value JSON 字符串。
   * @returns 解析后的对象，或 null。
   */
  private parseRecord(value: string | null): Record<string, unknown> | null {
    const parsed = this.parseJson(value);

    return this.isRecord(parsed) ? parsed : null;
  }

  /**
   * 解析 JSON 字符串；为空或解析失败返回 null。
   * @param value JSON 字符串。
   * @returns 解析结果，或 null。
   */
  private parseJson(value: string | null): unknown {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  /**
   * 类型守卫：值是否是普通对象（非 null 非数组）。
   * @param value 任意值。
   * @returns 是普通对象则收窄类型。
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
