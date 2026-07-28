import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Character, Message, PromptPreset } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { canonicalJson, canonicalSha256 } from '../../common/canonical-json';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelGatewayService } from '../../services/model-gateway';
import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
} from '../../services/prompt-builder/prompt-builder.constants';
import { resolveModelPromptBudget } from '../../services/prompt-builder/prompt-budget';
import { estimatePromptTextTokens } from '../../services/prompt-builder/token-estimator';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { GenerationLifecycleService } from '../../services/context-engine/generation-lifecycle.service';
import { ConversationTimelineService } from '../../services/context-engine/timeline.service';
import { shouldTryNextModelCandidate } from '../../services/context-engine/model-fallback-policy';
import type {
  GenerationPurpose,
  PreparedGeneration,
  ProposedGenerationTrace
} from '../../services/context-engine/generation-lifecycle.types';
import { buildTavernPromptSections } from '../../services/context-engine/prompt-section-builder';
import {
  WorldBookRuntimeService,
  type WorldBookRuntimeResult
} from '../../services/context-engine/world-book-runtime.service';
import { compilePromptSections } from '../../services/context-engine/provider-prompt-compiler';
import {
  parsePresetOutputRuleOperations,
  parsePresetStringArray
} from '../../services/context-engine/preset-rule-compiler';
import type { CompiledPrompt } from '../../services/context-engine/prompt-section.types';
import type {
  BuildPromptInput,
  ChatMessageLike,
  PromptBuildPurpose,
  PromptModelParameters,
  WorldBookContext
} from '../../services/prompt-builder/types';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig, ModelGenerationParams } from '../models/model.types';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUser } from '../users/user.types';
import { WorldBooksService } from '../world-books/world-books.service';
import type {
  ChatConversation,
  ChatMessageMetadata,
  ChatResponseLike,
  ChatSseEventName,
  ChatSseEventPayload,
  ChatTask
} from './chat.types';
import { StreamChatDto } from './dto/stream-chat.dto';
import { SuggestChatRepliesDto } from './dto/suggest-chat-replies.dto';

/** 流式聊天准备好的消息集：当前用户消息 + assistant 占位 + 历史。 */
type PreparedChatStreamMessages = {
  currentUserMessage: Message;
  assistantMessage: Message;
  history: Message[];
};

type ChatTemplateVariables = {
  characterName: string;
  userName: string;
};

type ChatSuggestionResult = {
  suggestions: Array<{
    id: string;
    text: string;
  }>;
};

const DEFAULT_CHAT_SUGGESTION_COUNT = 3;
const MAX_CHAT_SUGGESTION_COUNT = 5;

/**
 * 聊天服务：SSE 流式对话的核心。
 *
 * 设计要点：
 * - 会话级并发锁（conversationTasks）：同一会话同时只允许一个生成任务；
 * - 客户端断开连接时通过 AbortController 中止模型请求；
 * - assistant 消息先建占位（status=generating），流结束后更新终态（complete/failed/stopped）；
 * - 支持两种模式：新对话（userMessage）和重新生成（regenerateMessageId）。
 */
@Injectable()
export class ChatService {
  /** 会话级任务锁：conversationId → 进行中的任务。 */
  private readonly conversationTasks = new Map<string, ChatTask>();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ModelGatewayService)
    private readonly modelGateway: ModelGatewayService,
    @Inject(ModelsService)
    private readonly modelsService: ModelsService,
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
    @Inject(TargetEventsService)
    private readonly targetEvents: TargetEventsService,
    @Inject(GenerationLifecycleService)
    private readonly lifecycle: GenerationLifecycleService,
    @Inject(WorldBookRuntimeService)
    private readonly worldBookRuntime: WorldBookRuntimeService,
    @Inject(ConversationTimelineService)
    private readonly timeline: ConversationTimelineService
  ) {}

  /** 公共分享入口使用的无认证目标参数入口；目标与 owner 均由 token 服务端解析。 */
  streamInternal(params: {
    owner: CurrentUser;
    conversationId: string;
    payload: Omit<StreamChatDto, 'conversationId'>;
    response: ChatResponseLike;
  }): Promise<void> {
    if (this.conversationTasks.has(params.conversationId)) {
      throw new ConflictException({
        code: ERROR_CODES.CHAT_CONVERSATION_BUSY,
        message: 'Conversation is already generating a response.'
      });
    }
    return this.stream(
      params.owner,
      Object.assign(new StreamChatDto(), params.payload, { conversationId: params.conversationId }),
      params.response
    );
  }

  stopInternal(conversationId: string): boolean {
    const task = this.conversationTasks.get(conversationId);
    if (!task) return false;
    task.abortController.abort();
    return true;
  }

  /**
   * 流式聊天主流程。
   *
   * 流程：设置 SSE → 加会话锁 → 校验模式 → 取会话/配置/预设/世界书 →
   * 准备消息（新建或重新生成）→ 构建 prompt → 流式调用模型并转发 delta →
   * 完成/失败/中止时更新消息终态 → 释放锁、结束响应。
   *
   * @param currentUser 当前登录用户。
   * @param dto 流式聊天入参。
   * @param response Express 响应对象，SSE 事件直接写入。
   * @returns 无返回值（响应由 SSE 事件流写出）。
   */
  async stream(
    currentUser: CurrentUser,
    dto: StreamChatDto,
    response: ChatResponseLike
  ): Promise<void> {
    // 设置 SSE 响应头
    this.prepareSseResponse(response);

    // 中断控制器：客户端断开时中止模型请求
    const abortController = new AbortController();
    let streamFinished = false;
    // 客户端关闭连接时，若流未完成则中止
    const closeHandler = (): void => {
      if (!streamFinished) {
        abortController.abort();
      }
    };
    response.on('close', closeHandler);

    let task: ChatTask | null = null;
    let assistantMessage: Message | null = null;
    let generation: Extract<PreparedGeneration<Message>, { state: 'started' }> | null = null;
    let assistantContent = '';
    let assistantTemplateBuffer = '';
    let finishReason: string | null = null;
    let templateVariables: ChatTemplateVariables | null = null;

    try {
      // 1. 获取会话任务锁（防止同一会话并发生成）
      task = this.acquireConversationTask(dto.conversationId, abortController);
      // 2. 校验模式：userMessage 和 regenerateMessageId 二选一
      this.assertStreamMode(dto);
      // 3. 取会话 + 模型配置 + 预设 + 世界书 + 历史条数
      const conversation = await this.findOwnedActiveConversation(currentUser, dto.conversationId);
      templateVariables = this.createTemplateVariables(conversation);
      const modelCandidates = await this.modelsService.getGatewayCandidates({
        currentUser,
        modelFallbackGroupId: dto.modelFallbackGroupId ?? conversation.modelFallbackGroupId
      });
      const promptPreset = await this.resolvePromptPreset(currentUser, dto, conversation);
      const worldBooks = await this.worldBooksService.listPromptContexts(
        currentUser,
        conversation.characterId,
        { conversationId: conversation.id, personaId: conversation.personaId }
      );
      const historyTake = this.resolveHistoryTake(dto.historyLimit, worldBooks);

      // 4. 校验模型链至少有一个可调用候选（apiKey 必须有）
      this.assertModelCandidatesReady(modelCandidates);

      // 5. 准备消息：重新生成模式软删原消息建新占位；否则新建 user 消息 + assistant 占位
      const preparedGeneration = await this.lifecycle.beginConversation(conversation.id, {
        requestId: dto.requestId,
        userMessage: dto.userMessage,
        regenerateMessageId: dto.regenerateMessageId,
        turnId: dto.turnId,
        requestContext: dto
      });
      if (preparedGeneration.state === 'idempotent_complete') {
        this.writeSse(response, 'done', {
          messageId: preparedGeneration.messageId,
          finishReason: 'stop',
          idempotentReplay: true
        });
        return;
      }
      generation = preparedGeneration;
      const preparedMessages: PreparedChatStreamMessages = {
        currentUserMessage: generation.userMessage,
        assistantMessage: generation.assistantMessage,
        history: await this.listRecentMessages(conversation.id, historyTake, [
          generation.userMessage.id,
          generation.assistantMessage.id,
          ...(dto.regenerateMessageId ? [dto.regenerateMessageId] : [])
        ])
      };
      const worldBookRuntime = await this.worldBookRuntime.evaluateConversation({
        conversationId: conversation.id,
        worldBooks,
        history: preparedMessages.history.map((message) => this.toChatMessageLike(message)),
        currentUserMessage: this.toChatMessageLike(preparedMessages.currentUserMessage),
        purpose: generation.purpose
      });

      assistantMessage = preparedMessages.assistantMessage;
      task.assistantMessageId = assistantMessage.id;
      this.targetEvents.emit('conversation', conversation.id, 'message_created', {
        message: this.toPublicEventMessage(preparedMessages.currentUserMessage)
      });
      this.targetEvents.emit('conversation', conversation.id, 'generation_started', {
        message: this.toPublicEventMessage(assistantMessage)
      });

      const fallbackAttempts: NonNullable<ChatMessageMetadata['modelFallback']>['attempts'] = [];

      // 6. 流式调用模型链；每个候选按自己的上下文长度重新构建 Prompt。
      for (const [candidateIndex, candidate] of modelCandidates.entries()) {
        let candidateEmittedDelta = false;
        let candidateError: { code: string; message: string } | null = null;
        let compiled: CompiledPrompt | null = null;
        let trace: ProposedGenerationTrace | null = null;
        const modelParameters = this.mergeModelParams(candidate.params, promptPreset, {
          isRegenerate: Boolean(dto.regenerateMessageId)
        });
        const attempt = await this.lifecycle.createConversationAttempt(
          generation.requestDatabaseId,
          candidateIndex,
          candidate.providerModelId ?? candidate.modelName
        );

        try {
          const buildInput = this.toBuildPromptInput({
            currentUser,
            conversation,
            history: preparedMessages.history,
            currentUserMessage: preparedMessages.currentUserMessage,
            promptPreset,
            gatewayConfig: candidate,
            worldBooks: [],
            dto
          });
          compiled = compilePromptSections({
            sections: [
              ...buildTavernPromptSections(buildInput, generation.purpose),
              ...worldBookRuntime.sections
            ],
            purpose: generation.purpose,
            capabilities: candidate.capabilities,
            maxPromptTokens: this.resolvePromptBudget(candidate, promptPreset)
          });
          trace = this.toGenerationTrace(
            compiled,
            candidate,
            modelParameters,
            generation.userMessage.id,
            worldBookRuntime
          );
          await this.lifecycle.updateConversationAttemptSnapshot(attempt.id, {
            hash: trace.promptSnapshotHash,
            capabilities: candidate.capabilities,
            parameters: modelParameters
          });
        } catch (error) {
          candidateError = this.toModelGatewayErrorPayload(error);
        }

        if (compiled) {
          for await (const event of this.modelGateway.streamChat(compiled.messages, {
            providerName: candidate.providerName,
            baseUrl: candidate.baseUrl,
            modelName: candidate.modelName,
            apiKey: candidate.apiKey,
            requestSource: 'tavern_chat',
            signal: abortController.signal,
            ...modelParameters
          })) {
            // 客户端中断：抛错走 catch（标 stopped）
            if (abortController.signal.aborted) {
              throw new Error('Chat stream aborted.');
            }

            // delta：累积内容 + 转发增量给前端
            if (event.type === 'delta') {
              candidateEmittedDelta = true;
              const resolvedDelta = this.resolveTemplateDelta(
                assistantTemplateBuffer + event.text,
                templateVariables,
                false
              );
              assistantTemplateBuffer = resolvedDelta.pending;

              if (resolvedDelta.text.length > 0) {
                assistantContent += resolvedDelta.text;
                this.writeSse(response, 'delta', {
                  text: resolvedDelta.text,
                  messageId: assistantMessage.id
                });
                this.targetEvents.emit('conversation', conversation.id, 'delta', {
                  text: resolvedDelta.text,
                  messageId: assistantMessage.id
                });
              }
              continue;
            }

            // done：完成消息 + 发完成事件 + 结束
            if (event.type === 'done') {
              finishReason = event.result.finishReason ?? 'stop';
              const resolvedTail = this.resolveTemplateDelta(
                assistantTemplateBuffer,
                templateVariables,
                true
              );
              assistantTemplateBuffer = resolvedTail.pending;

              if (resolvedTail.text.length > 0) {
                assistantContent += resolvedTail.text;
                this.writeSse(response, 'delta', {
                  text: resolvedTail.text,
                  messageId: assistantMessage.id
                });
              }
              fallbackAttempts.push({
                providerName: candidate.providerName,
                modelName: candidate.modelName,
                status: 'succeeded'
              });
              await this.lifecycle.finishConversationAttempt(
                attempt.id,
                'succeeded',
                candidateEmittedDelta
              );
              if (!trace) {
                throw new Error('Generation trace was not prepared.');
              }
              await this.lifecycle.completeConversation({
                conversationId: conversation.id,
                requestDatabaseId: generation.requestDatabaseId,
                turnId: generation.turnId,
                assistantMessageId: assistantMessage.id,
                expectedVersion: generation.expectedVersion,
                content: assistantContent,
                tokenCount: this.estimateTokens(assistantContent),
                purpose: generation.purpose,
                trace
              });
              this.writeSse(response, 'done', {
                messageId: assistantMessage.id,
                finishReason
              });
              this.targetEvents.emit('conversation', conversation.id, 'generation_done', {
                messageId: assistantMessage.id,
                finishReason
              });
              return;
            }

            // error：未输出任何 delta 时可切下一个；已输出则停止，避免拼接两次生成
            if (event.type === 'error') {
              candidateError = {
                code: event.code,
                message: event.message
              };
              break;
            }
          }
        }

        if (!candidateError) {
          continue;
        }

        fallbackAttempts.push({
          providerName: candidate.providerName,
          modelName: candidate.modelName,
          status: 'failed',
          reason: candidateError.message
        });
        await this.lifecycle.finishConversationAttempt(
          attempt.id,
          abortController.signal.aborted ? 'stopped' : 'failed',
          candidateEmittedDelta,
          candidateError.code
        );

        const hasNextCandidate = candidateIndex < modelCandidates.length - 1;

        if (
          shouldTryNextModelCandidate({
            emittedDelta: candidateEmittedDelta,
            accumulatedContent: assistantContent,
            hasNextCandidate,
            aborted: abortController.signal.aborted
          })
        ) {
          continue;
        }

        const resolvedTail = this.resolveTemplateDelta(
          assistantTemplateBuffer,
          templateVariables,
          true
        );
        assistantTemplateBuffer = resolvedTail.pending;

        if (resolvedTail.text.length > 0) {
          assistantContent += resolvedTail.text;
          this.writeSse(response, 'delta', {
            text: resolvedTail.text,
            messageId: assistantMessage.id
          });
        }
        await this.lifecycle.failConversation({
          conversationId: conversation.id,
          requestDatabaseId: generation.requestDatabaseId,
          turnId: generation.turnId,
          assistantMessageId: assistantMessage.id,
          content: assistantContent,
          status: 'failed',
          errorCode: candidateError.code
        });
        this.writeSse(response, 'error', {
          code: candidateError.code,
          message: candidateError.message
        });
        this.targetEvents.emit('conversation', dto.conversationId, 'generation_failed', {
          messageId: assistantMessage.id,
          code: candidateError.code
        });
        return;
      }

      throw new Error('Model stream ended without a done event.');
    } catch (error) {
      // 异常处理：转成错误载荷
      const errorPayload = this.toErrorPayload(error, abortController.signal.aborted);

      if (assistantMessage && generation && errorPayload.code !== 'CONTEXT_COMMIT_CONFLICT') {
        const resolvedTail = this.resolveTemplateDelta(
          assistantTemplateBuffer,
          templateVariables,
          true
        );
        assistantTemplateBuffer = resolvedTail.pending;
        assistantContent += resolvedTail.text;
        // 客户端中断 → stopped；其它错误 → failed
        await this.lifecycle.failConversation({
          conversationId: dto.conversationId,
          requestDatabaseId: generation.requestDatabaseId,
          turnId: generation.turnId,
          assistantMessageId: assistantMessage.id,
          content: assistantContent,
          status: abortController.signal.aborted ? 'stopped' : 'failed',
          errorCode: errorPayload.code
        });
      }

      this.writeSse(response, 'error', errorPayload);
      this.targetEvents.emit('conversation', dto.conversationId, 'generation_failed', {
        messageId: assistantMessage?.id ?? null,
        code: errorPayload.code
      });
    } finally {
      // 清理：移除 close 监听、释放会话锁、结束响应
      response.off('close', closeHandler);
      if (task) {
        this.releaseConversationTask(task);
      }
      streamFinished = true;
      if (!response.writableEnded && !response.destroyed) {
        response.end();
      }
    }
  }

  /**
   * 生成用户下一轮可选发言。
   *
   * 该流程只读取会话上下文并调用模型，不创建 user/assistant 消息，也不更新 lastMessageAt。
   * @param currentUser 当前登录用户。
   * @param dto 候选生成入参。
   * @returns 三条左右可直接放入输入框的候选用户发言。
   */
  async suggestReplies(
    currentUser: CurrentUser,
    dto: SuggestChatRepliesDto
  ): Promise<ChatSuggestionResult> {
    if (this.conversationTasks.has(dto.conversationId)) {
      throw new ConflictException({
        code: ERROR_CODES.CHAT_CONVERSATION_BUSY,
        message: 'Conversation is already generating a response.'
      });
    }

    const count = Math.min(
      Math.max(dto.count ?? DEFAULT_CHAT_SUGGESTION_COUNT, 1),
      MAX_CHAT_SUGGESTION_COUNT
    );
    const conversation = await this.findOwnedActiveConversation(currentUser, dto.conversationId);
    const templateVariables = this.createTemplateVariables(conversation);
    const modelCandidates = await this.modelsService.getGatewayCandidates({
      currentUser,
      modelFallbackGroupId: dto.modelFallbackGroupId ?? conversation.modelFallbackGroupId
    });
    if (!modelCandidates[0]) {
      throw new BadRequestException({
        code: ERROR_CODES.CHAT_MODEL_CONFIG_REQUIRED,
        message: '请先配置至少一个模型链后再生成建议。'
      });
    }

    const promptPreset = await this.resolvePromptPreset(currentUser, dto, conversation);
    const worldBooks = await this.worldBooksService.listPromptContexts(
      currentUser,
      conversation.characterId,
      { conversationId: conversation.id, personaId: conversation.personaId }
    );
    const historyTake = this.resolveHistoryTake(dto.historyLimit, worldBooks);
    const history = await this.listRecentMessages(conversation.id, historyTake);
    const suggestionMessage = this.createSuggestionPromptMessage(conversation.id, count);
    const worldBookRuntime = await this.worldBookRuntime.evaluateConversation({
      conversationId: conversation.id,
      worldBooks,
      history: history.map((message) => this.toChatMessageLike(message)),
      currentUserMessage: this.toChatMessageLike(suggestionMessage),
      purpose: 'user_suggestions'
    });

    this.assertModelCandidatesReady(modelCandidates);

    let lastError: { code: string; message: string } | null = null;

    for (const candidate of modelCandidates) {
      try {
        const buildInput = this.toBuildPromptInput({
          currentUser,
          conversation,
          history,
          currentUserMessage: suggestionMessage,
          promptPreset,
          gatewayConfig: candidate,
          worldBooks: [],
          dto,
          purpose: 'user_suggestions'
        });
        const compiled = compilePromptSections({
          sections: [
            ...buildTavernPromptSections(buildInput, 'user_suggestions'),
            ...worldBookRuntime.sections
          ],
          purpose: 'user_suggestions',
          capabilities: candidate.capabilities,
          maxPromptTokens: this.resolvePromptBudget(candidate, promptPreset)
        });
        const result = await this.modelGateway.chat(compiled.messages, {
          providerName: candidate.providerName,
          baseUrl: candidate.baseUrl,
          modelName: candidate.modelName,
          apiKey: candidate.apiKey,
          requestSource: 'chat_suggestion',
          ...this.toSuggestionModelParams(this.mergeModelParams(candidate.params, promptPreset))
        });
        const suggestions = this.parseSuggestionTexts(result.text, count, templateVariables);

        if (suggestions.length > 0) {
          return {
            suggestions: suggestions.map((text, index) => ({
              id: `suggestion-${index + 1}`,
              text
            }))
          };
        }

        lastError = {
          code: ERROR_CODES.MODEL_GATEWAY_INVALID_RESPONSE,
          message: '模型返回成功，但没有解析出可用候选。'
        };
      } catch (error) {
        lastError = this.toModelGatewayErrorPayload(error);
      }
    }

    throw new BadRequestException({
      code: lastError?.code ?? ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      message: lastError?.message ?? '生成候选发言失败。'
    });
  }

  /**
   * 设置 SSE 响应头（事件流、禁缓存、禁代理缓冲）。
   * @param response Express 响应对象。
   */
  private prepareSseResponse(response: ChatResponseLike): void {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
  }

  /**
   * 获取会话任务锁：同一会话已有进行中任务则拒绝。
   * @param conversationId 会话 ID。
   * @param abortController 中断控制器。
   * @returns 会话任务对象。
   * @throws ConflictException 会话正在生成中（CHAT_CONVERSATION_BUSY）。
   */
  private acquireConversationTask(
    conversationId: string,
    abortController: AbortController
  ): ChatTask {
    if (this.conversationTasks.has(conversationId)) {
      throw new ConflictException({
        code: ERROR_CODES.CHAT_CONVERSATION_BUSY,
        message: 'Conversation is already generating a response.'
      });
    }

    const task = {
      conversationId,
      assistantMessageId: null,
      abortController
    };

    this.conversationTasks.set(conversationId, task);

    return task;
  }

  /**
   * 释放会话任务锁（仅当当前任务仍是自己时才删，防误删后续任务）。
   * @param task 会话任务。
   */
  private releaseConversationTask(task: ChatTask): void {
    if (this.conversationTasks.get(task.conversationId) === task) {
      this.conversationTasks.delete(task.conversationId);
    }
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
  ): Promise<ChatConversation> {
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
        modelFallbackGroup: true,
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
   * 解析本次聊天使用的预设。
   *
   * presetId 未传 → 用会话绑定的预设；
   * presetId 为 null/空 → 不用预设；
   * presetId 有值 → 查库校验归属。
   *
   * @param currentUser 当前登录用户。
   * @param dto 流式聊天入参。
   * @param conversation 会话记录。
   * @returns 预设记录，或 null。
   * @throws BadRequestException 指定了不存在的预设。
   */
  private async resolvePromptPreset(
    currentUser: CurrentUser,
    dto: StreamChatDto | SuggestChatRepliesDto,
    conversation: ChatConversation
  ): Promise<PromptPreset | null> {
    // 未传：用会话绑定的预设
    if (dto.presetId === undefined) {
      return conversation.promptPreset;
    }

    // 传 null/空：不用预设
    if (!dto.presetId) {
      return null;
    }

    // 传了 ID：查库校验归属
    const promptPreset = await this.prisma.promptPreset.findFirst({
      where: {
        id: dto.presetId,
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      }
    });

    if (!promptPreset) {
      throw new BadRequestException({
        code: ERROR_CODES.PROMPT_PRESET_NOT_FOUND,
        message: 'Prompt preset not found.'
      });
    }

    return promptPreset;
  }

  /**
   * 校验模型链就绪：至少有一个候选且带 apiKey。
   * @param modelCandidates 模型链候选。
   * @throws BadRequestException 无候选或未配置 apiKey（CHAT_MODEL_CONFIG_REQUIRED）。
   */
  private assertModelCandidatesReady(modelCandidates: ModelGatewayConfig[]): void {
    if (modelCandidates.length === 0 || !modelCandidates.some((candidate) => candidate.apiKey)) {
      throw new BadRequestException({
        code: ERROR_CODES.CHAT_MODEL_CONFIG_REQUIRED,
        message: '请先配置至少一个模型链后再开始聊天。'
      });
    }
  }

  /**
   * 校验流式模式：userMessage 和 regenerateMessageId 必须二选一。
   * @param dto 流式聊天入参。
   * @throws BadRequestException 两者都传或都不传。
   */
  private assertStreamMode(dto: StreamChatDto): void {
    const hasUserMessage = typeof dto.userMessage === 'string' && dto.userMessage.trim().length > 0;
    const hasRegenerateMessage = Boolean(dto.regenerateMessageId);

    // 两者同真假（都传或都不传）→ 拒绝
    if (hasUserMessage === hasRegenerateMessage) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Provide either userMessage or regenerateMessageId.'
      });
    }
  }

  /**
   * 构造只存在于内存中的候选生成指令消息。
   * @param conversationId 会话 ID。
   * @param count 期望候选条数。
   * @returns PromptBuilder 可消费的 Message 形态。
   */
  private createSuggestionPromptMessage(conversationId: string, count: number): Message {
    const now = new Date();

    return {
      id: `suggestion-request-${now.getTime()}`,
      conversationId,
      turnId: null,
      role: 'user',
      content: [
        `请根据提供的上下文生成 ${count} 条下一轮可以直接发送的候选发言。`,
        '每条 1 到 2 句话，使用自然口语。'
      ].join('\n'),
      status: 'complete',
      metadataJson: this.stringifyNullable({
        source: 'chat-suggestions',
        transient: true
      }),
      tokenCount: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
  }

  /**
   * 将聊天模型参数压缩成候选生成适用范围。
   * @param params 已合并的模型参数。
   * @returns 候选生成调用参数。
   */
  private toSuggestionModelParams(params: PromptModelParameters): PromptModelParameters {
    return {
      ...params,
      temperature: Math.max(params.temperature ?? 0.85, 0.75),
      maxTokens: Math.min(Math.max(params.maxTokens ?? 240, 120), 500)
    };
  }

  /**
   * 解析模型返回的候选发言，兼容 JSON 数组、对象字段和编号列表。
   * @param rawText 模型原始文本。
   * @param count 期望条数。
   * @param variables 模板变量上下文。
   * @returns 去重、裁剪后的候选文本。
   */
  private parseSuggestionTexts(
    rawText: string,
    count: number,
    variables: ChatTemplateVariables
  ): string[] {
    const candidates = this.extractSuggestionCandidates(rawText);
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const candidate of candidates) {
      const text = this.normalizeSuggestionText(
        this.resolveTemplateVariables(candidate, variables)
      );

      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      suggestions.push(text);

      if (suggestions.length >= count) {
        break;
      }
    }

    return suggestions;
  }

  /**
   * 从模型输出中提取候选字符串集合。
   * @param rawText 模型原始输出。
   * @returns 原始候选文本数组。
   */
  private extractSuggestionCandidates(rawText: string): string[] {
    const withoutFence = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const jsonSlice = this.sliceJsonLikeText(withoutFence);
    const parsed = jsonSlice ? this.parseJson(jsonSlice) : null;

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }

    if (this.isRecord(parsed)) {
      const list = parsed.suggestions ?? parsed.options ?? parsed.replies;

      if (Array.isArray(list)) {
        return list
          .map((item) => (typeof item === 'string' ? item : this.isRecord(item) ? item.text : null))
          .filter((item): item is string => typeof item === 'string');
      }
    }

    return withoutFence
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, ''))
      .filter(Boolean);
  }

  /**
   * 从文本中截出最可能的 JSON 数组或对象。
   * @param value 原始文本。
   * @returns JSON 片段，找不到则返回 null。
   */
  private sliceJsonLikeText(value: string): string | null {
    const arrayStart = value.indexOf('[');
    const arrayEnd = value.lastIndexOf(']');

    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return value.slice(arrayStart, arrayEnd + 1);
    }

    const objectStart = value.indexOf('{');
    const objectEnd = value.lastIndexOf('}');

    if (objectStart !== -1 && objectEnd > objectStart) {
      return value.slice(objectStart, objectEnd + 1);
    }

    return null;
  }

  /**
   * 清理单条候选文本。
   * @param value 原始候选。
   * @returns 可展示文本。
   */
  private normalizeSuggestionText(value: string): string {
    return value
      .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  /**
   * 将模型网关异常转成业务错误载荷。
   * @param error 任意异常。
   * @returns code/message。
   */
  private toModelGatewayErrorPayload(error: unknown): { code: string; message: string } {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      error instanceof Error
    ) {
      return {
        code: (error as { code: string }).code,
        message: error.message
      };
    }

    return {
      code: ERROR_CODES.MODEL_GATEWAY_REQUEST_FAILED,
      message: error instanceof Error && error.message ? error.message : '生成候选发言失败。'
    };
  }

  /**
   * 取会话最近的历史消息（倒序取再反转为正序）。
   *
   * 筛选条件：complete/edited 状态的，或 role=user 的（包含刚创建的 user 消息）。
   * @param conversationId 会话 ID。
   * @param historyLimit 历史条数限制。
   * @returns 正序的历史消息数组。
   */
  private async listRecentMessages(
    conversationId: string,
    historyLimit: number | undefined,
    excludeIds: string[] = []
  ): Promise<Message[]> {
    const take = Math.max(1, Math.min(historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT, 100));
    return this.timeline.listPromptMessages(conversationId, { take, excludeIds });
  }

  private toPublicEventMessage(message: Message) {
    return {
      messageId: message.id,
      turnId: message.turnId,
      role: message.role,
      content: message.content,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };
  }

  /**
   * 把会话及关联实体组装成 PromptBuilder 的输入结构。
   * @param params 组装所需各参数。
   * @returns PromptBuilder 构建输入。
   */
  private toBuildPromptInput(params: {
    currentUser: CurrentUser;
    conversation: ChatConversation;
    history: Message[];
    currentUserMessage: Message;
    promptPreset: PromptPreset | null;
    gatewayConfig: ModelGatewayConfig;
    worldBooks: WorldBookContext[];
    dto: StreamChatDto | SuggestChatRepliesDto;
    purpose?: PromptBuildPurpose;
  }): BuildPromptInput {
    return {
      userId: params.currentUser.id,
      conversation: {
        id: params.conversation.id,
        userId: params.conversation.userId,
        characterId: params.conversation.characterId,
        title: params.conversation.title,
        metadata: this.parseRecord(params.conversation.metadataJson)
      },
      character: this.toCharacterContext(params.conversation.character, params.conversation.id),
      persona: params.conversation.persona
        ? {
            id: params.conversation.persona.id,
            name: params.conversation.persona.name,
            coreIdentity: params.conversation.persona.coreIdentity,
            background: params.conversation.persona.background,
            interactionPreferences: params.conversation.persona.interactionPreferences,
            metadata: this.parseRecord(params.conversation.persona.metadataJson)
          }
        : null,
      promptPreset: params.promptPreset
        ? {
            id: params.promptPreset.id,
            name: params.promptPreset.name,
            description: params.promptPreset.description,
            instructions: parsePresetStringArray(params.promptPreset.instructionsJson),
            outputRuleOperations: parsePresetOutputRuleOperations(
              params.promptPreset.outputRuleOperationsJson
            ),
            generationPurposes: parseGenerationPurposes(params.promptPreset.generationPurposesJson),
            parameters: this.parseParams(params.promptPreset.parametersJson),
            metadata: this.parseRecord(params.promptPreset.metadataJson)
          }
        : null,
      modelGateway: {
        id: params.gatewayConfig.providerModelId ?? '',
        name: params.gatewayConfig.displayName ?? params.gatewayConfig.modelName,
        providerName: params.gatewayConfig.providerName,
        baseUrl: params.gatewayConfig.baseUrl,
        modelName: params.gatewayConfig.modelName,
        parameters: params.gatewayConfig.params,
        metadata: null
      },
      history: params.history.map((message) => this.toChatMessageLike(message)),
      currentUserMessage: this.toChatMessageLike(params.currentUserMessage),
      worldBooks: params.worldBooks,
      options: {
        mode: 'chat',
        purpose: params.purpose ?? 'chat_reply',
        historyLimit: params.dto.historyLimit,
        maxHistoryCharacters:
          params.dto.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS,
        maxPromptTokens: this.resolvePromptBudget(params.gatewayConfig, params.promptPreset),
        includeDebug: false,
        supportsDeveloperRole: false
      }
    };
  }

  /**
   * 角色记录 → PromptBuilder 用的角色上下文（解析示例对话和 metadata）。
   * @param character 角色记录。
   * @param conversationId 会话 ID（用于示例消息标记 id）。
   * @returns 角色上下文。
   */
  private toCharacterContext(character: Character, conversationId: string) {
    return {
      id: character.id,
      name: character.name,
      coreIdentity: character.coreIdentity,
      personality: character.personality,
      persistentPremise: character.persistentPremise,
      initialScenario: character.initialScenario,
      extendedBackground: character.extendedBackground,
      characterRules: character.characterRules,
      speechStyle: character.speechStyle,
      firstMessage: character.firstMessage,
      exampleMessages: this.parseExampleMessages(character.exampleMessagesJson, conversationId),
      metadata: this.parseRecord(character.metadataJson)
    };
  }

  /**
   * 决定取多少条历史消息：取 historyLimit 和世界书扫描深度的较大值。
   * 世界书扫描需要足够消息触发关键词，故取较大值。
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

    return Math.max(promptHistoryLimit, worldBookScanDepth);
  }

  /** 按模型上下文长度扣除输出预算，得到 Builder 可使用的输入 token 预算。 */
  private resolvePromptBudget(
    gatewayConfig: ModelGatewayConfig,
    promptPreset: PromptPreset | null
  ): number {
    const presetParameters = promptPreset ? this.parseParams(promptPreset.parametersJson) : null;

    return resolveModelPromptBudget(gatewayConfig, presetParameters?.maxTokens);
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

  private toGenerationTrace(
    compiled: CompiledPrompt,
    candidate: ModelGatewayConfig,
    modelParameters: PromptModelParameters,
    userMessageId: string,
    worldBookRuntime: WorldBookRuntimeResult
  ): ProposedGenerationTrace {
    const capabilities = candidate.capabilities;
    const sections = compiled.sections.map((item) => ({
      sectionId: item.section.id,
      sectionKind: item.section.kind,
      sourceType: item.section.sourceType,
      sourceId: item.section.sourceId ?? null,
      sourceRevisionId: item.section.sourceRevisionId ?? null,
      contentHash: canonicalSha256(item.section.content),
      compactUsed: item.compactUsed,
      placement: item.section.placement,
      conversationRole: item.section.conversationRole ?? null,
      finalProviderRole: item.finalProviderRole,
      tokenEstimate: item.tokenEstimate,
      included: item.included,
      excludedReason: item.excludedReason
    }));
    const snapshot = {
      compilerVersion: compiled.compilerVersion,
      messages: compiled.messages,
      parameters: modelParameters,
      capabilities,
      sections
    };
    const includedWorldBooks = worldBookRuntime.includedWorldBooks.filter((trace) =>
      compiled.sections.some((item) => item.included && item.section.sourceId === trace.entryId)
    );
    const includedEntryIds = new Set(includedWorldBooks.map((trace) => trace.entryId));
    return {
      requestUserMessageId: userMessageId,
      rootUserMessageId: userMessageId,
      modelId: candidate.providerModelId ?? candidate.modelName,
      compilerVersion: compiled.compilerVersion,
      promptSnapshotJson: canonicalJson(snapshot),
      promptSnapshotHash: canonicalSha256(snapshot),
      capabilitiesSnapshotJson: canonicalJson(capabilities),
      modelParametersJson: canonicalJson(modelParameters),
      includedWorldBooks,
      worldBookStateChanges: worldBookRuntime.stateChanges.filter(
        (change) =>
          includedEntryIds.has(change.entryId) || change.payload.sourceType === 'delay_pending'
      ),
      sections
    };
  }

  /**
   * 合并模型配置参数和预设参数（预设覆盖模型配置），并注入防重复默认值。
   *
   * 默认注入 frequencyPenalty=0.5 / presencePenalty=0.3，缓解长会话下模型陷入套话循环
   * （历史里堆叠多条同质化 assistant 回复时，模型会持续模仿相同开头与句式）。
   * 模型配置或预设显式传入这两个字段时覆盖默认值。
   *
   * 重新生成模式（isRegenerate）下临时提高 temperature 与两个 penalty：
   * 固定上下文+固定参数下模型输出确定性很强，重生成会得到几乎相同结果，
   * 扰动后让重新生成真正产出不同回复。
   *
   * @param modelParams 模型配置参数。
   * @param promptPreset 预设。
   * @param options 选项（isRegenerate 是否重新生成模式）。
   * @returns 合并后的参数。
   */
  private mergeModelParams(
    modelParams: ModelGenerationParams,
    promptPreset: PromptPreset | null,
    options: { isRegenerate?: boolean } = {}
  ): PromptModelParameters {
    const merged: PromptModelParameters = {
      // 防重复默认值：模型配置/预设可覆盖。
      // 调高（freq 0.6→1.0, pres 0.4→0.6）：长会话下历史堆叠同质化 assistant 回复，
      // 模型会陷入句式级模仿（每轮复刻同一开头），token 级 penalty 必须够强才能压住。
      frequencyPenalty: 1.0,
      presencePenalty: 0.6,
      ...modelParams,
      ...(promptPreset ? (this.parseParams(promptPreset.parametersJson) ?? {}) : {})
    };

    if (options.isRegenerate) {
      // 重新生成：提高温度 + 加强 penalty，避免复现上一次结果
      merged.temperature = Math.min((merged.temperature ?? 0.8) + 0.2, 1.5);
      merged.frequencyPenalty = Math.min((merged.frequencyPenalty ?? 0.5) + 0.3, 2);
      merged.presencePenalty = Math.min((merged.presencePenalty ?? 0.3) + 0.2, 2);
    }

    return merged;
  }

  /**
   * 写一条 SSE 事件（event + data 两行 + 空行结束）。响应已结束则跳过。
   * @param response Express 响应对象。
   * @param eventName 事件名。
   * @param payload 事件载荷。
   */
  private writeSse(
    response: ChatResponseLike,
    eventName: ChatSseEventName,
    payload: ChatSseEventPayload
  ): void {
    if (response.writableEnded || response.destroyed) {
      return;
    }

    response.write(`event: ${eventName}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  /**
   * 创建聊天输出占位符上下文。
   * @param conversation 会话及关联角色/Persona。
   * @returns 可用于替换 `{{char}}`、`{{user}}` 等模板变量的值。
   */
  private createTemplateVariables(conversation: ChatConversation): ChatTemplateVariables {
    return {
      characterName: conversation.character.name.trim() || 'Assistant',
      userName: conversation.persona?.name.trim() || 'User'
    };
  }

  /**
   * 解析流式 delta 里的模板变量，并保留可能跨 chunk 的未完成占位符。
   * @param value 当前缓存加新 delta。
   * @param variables 模板变量上下文。
   * @param flush 是否强制清空缓存。
   * @returns 本次可发送文本和仍需等待后续 chunk 的尾部缓存。
   */
  private resolveTemplateDelta(
    value: string,
    variables: ChatTemplateVariables | null,
    flush: boolean
  ): { text: string; pending: string } {
    if (!variables || value.length === 0) {
      return {
        text: value,
        pending: ''
      };
    }

    if (flush) {
      return {
        text: this.resolveTemplateVariables(value, variables),
        pending: ''
      };
    }

    const pendingStart = this.findPendingTemplateStart(value);
    const safeText = pendingStart === -1 ? value : value.slice(0, pendingStart);
    const pending = pendingStart === -1 ? '' : value.slice(pendingStart);

    return {
      text: this.resolveTemplateVariables(safeText, variables),
      pending
    };
  }

  /**
   * 找到需要继续等待的占位符起点。
   * @param value 待检查文本。
   * @returns 起点下标；没有未完成占位符时返回 -1。
   */
  private findPendingTemplateStart(value: string): number {
    const lastBraceOpen = value.lastIndexOf('{{');

    if (lastBraceOpen !== -1 && value.indexOf('}}', lastBraceOpen) === -1) {
      return lastBraceOpen;
    }

    const angleTokens = ['<BOT>', '<USER>'];
    const upperValue = value.toUpperCase();

    for (const token of angleTokens) {
      const maxPrefixLength = Math.min(token.length - 1, value.length);

      for (let length = maxPrefixLength; length > 0; length -= 1) {
        const suffix = upperValue.slice(-length);

        if (token.startsWith(suffix)) {
          return value.length - length;
        }
      }
    }

    return -1;
  }

  /**
   * 替换常见酒馆模板变量。
   * @param value 原始文本。
   * @param variables 模板变量上下文。
   * @returns 替换后的文本。
   */
  private resolveTemplateVariables(value: string, variables: ChatTemplateVariables): string {
    return value
      .replace(/\{\{\s*(char|character|bot|assistant|char_name)\s*\}\}/gi, variables.characterName)
      .replace(/\{\{\s*(user|persona|user_name)\s*\}\}/gi, variables.userName)
      .replace(/<BOT>/gi, variables.characterName)
      .replace(/<USER>/gi, variables.userName);
  }

  /**
   * 把异常转成错误载荷。
   * - 客户端中断 → CHAT_STREAM_ABORTED；
   * - NestJS 异常（含 response.code/message）→ 用其 code/message；
   * - 其它 → INTERNAL_SERVER_ERROR。
   * @param error 捕获的异常。
   * @param aborted 是否客户端中断。
   * @returns 错误载荷（code + message）。
   */
  private toErrorPayload(error: unknown, aborted: boolean): { code: string; message: string } {
    if (aborted) {
      return {
        code: ERROR_CODES.CHAT_STREAM_ABORTED,
        message: 'Chat stream stopped by client.'
      };
    }

    if (this.isExceptionResponse(error)) {
      return {
        code: error.response.code,
        message: error.response.message
      };
    }

    return {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: error instanceof Error && error.message ? error.message : 'Chat stream failed.'
    };
  }

  /**
   * 类型守卫：是否是带 response.code/message 的 NestJS 异常。
   * @param error 任意值。
   * @returns 是则收窄类型。
   */
  private isExceptionResponse(error: unknown): error is {
    response: {
      code: string;
      message: string;
    };
  } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { code?: unknown } }).response?.code !== undefined &&
      typeof (error as { response?: { code?: unknown } }).response?.code === 'string' &&
      typeof (error as { response?: { message?: unknown } }).response?.message === 'string'
    );
  }

  /**
   * 解析角色示例对话 JSON 为消息数组（校验结构，过滤非法项）。
   * @param value exampleMessagesJson 字符串。
   * @param conversationId 会话 ID。
   * @returns 解析后的消息数组。
   */
  private parseExampleMessages(value: string | null, conversationId: string): ChatMessageLike[] {
    const parsed = this.parseJson(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

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

  /**
   * 把结构化数据序列化成 JSON 字符串；undefined/null 返回 null。
   * @param value 任意值。
   * @returns JSON 字符串，undefined/null 返回 null。
   */
  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  /** 使用统一的中英文混合文本 token 估算。 */
  private estimateTokens(content: string): number {
    return estimatePromptTextTokens(content);
  }
}

function parseGenerationPurposes(value: string): GenerationPurpose[] {
  return parsePresetStringArray(value).filter((purpose): purpose is GenerationPurpose =>
    ['chat_reply', 'regenerate', 'continue', 'user_suggestions', 'memory_summary'].includes(purpose)
  );
}
