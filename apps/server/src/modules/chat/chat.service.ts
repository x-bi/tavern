import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Character, Message, PromptPreset } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelGatewayService, type ModelGatewayStreamEvent } from '../../services/model-gateway';
import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
} from '../../services/prompt-builder/prompt-builder.constants';
import { PromptBuilderService } from '../../services/prompt-builder/prompt-builder.service';
import type {
  BuildPromptInput,
  ChatMessageLike,
  PromptModelParameters,
  WorldBookContext
} from '../../services/prompt-builder/types';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig, ModelConfigParams } from '../models/model-config.types';
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

/** 流式聊天准备好的消息集：当前用户消息 + assistant 占位 + 历史。 */
type PreparedChatStreamMessages = {
  currentUserMessage: Message;
  assistantMessage: Message;
  history: Message[];
};

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
    @Inject(PromptBuilderService)
    private readonly promptBuilder: PromptBuilderService,
    @Inject(ModelGatewayService)
    private readonly modelGateway: ModelGatewayService,
    @Inject(ModelsService)
    private readonly modelsService: ModelsService,
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService
  ) {}

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
    let assistantContent = '';
    let finishReason: string | null = null;

    try {
      // 1. 获取会话任务锁（防止同一会话并发生成）
      task = this.acquireConversationTask(dto.conversationId, abortController);
      // 2. 校验模式：userMessage 和 regenerateMessageId 二选一
      this.assertStreamMode(dto);
      // 3. 取会话 + 模型配置 + 预设 + 世界书 + 历史条数
      const conversation = await this.findOwnedActiveConversation(currentUser, dto.conversationId);
      const modelConfig = await this.modelsService.getGatewayConfig(
        currentUser,
        dto.modelConfigId ?? conversation.modelConfigId
      );
      const promptPreset = await this.resolvePromptPreset(currentUser, dto, conversation);
      const worldBooks = await this.worldBooksService.listPromptContexts(
        currentUser,
        conversation.characterId
      );
      const historyTake = this.resolveHistoryTake(dto.historyLimit, worldBooks);

      // 4. 校验模型配置就绪（apiKey 必须有）
      this.assertModelConfigReady(modelConfig);

      // 5. 准备消息：重新生成模式软删原消息建新占位；否则新建 user 消息 + assistant 占位
      const preparedMessages = dto.regenerateMessageId
        ? await this.prepareRegenerateMessages(
            conversation.id,
            dto.regenerateMessageId,
            historyTake
          )
        : await this.prepareNewMessages(conversation.id, dto.userMessage, historyTake);

      assistantMessage = preparedMessages.assistantMessage;
      task.assistantMessageId = assistantMessage.id;

      // 6. 构建 prompt（promptBuilder 组装各 section、裁剪历史、匹配世界书）
      const prompt = this.promptBuilder.build(
        this.toBuildPromptInput({
          currentUser,
          conversation,
          history: preparedMessages.history,
          currentUserMessage: preparedMessages.currentUserMessage,
          promptPreset,
          modelConfig,
          worldBooks,
          dto
        })
      );

      // 7. 流式调用模型，逐事件处理
      for await (const event of this.modelGateway.streamChat(prompt.finalMessages, {
        providerName: modelConfig.providerName,
        baseUrl: modelConfig.baseUrl,
        modelName: modelConfig.modelName,
        apiKey: modelConfig.apiKey,
        signal: abortController.signal,
        ...this.mergeModelParams(modelConfig.params, promptPreset)
      })) {
        // 客户端中断：抛错走 catch（标 stopped）
        if (abortController.signal.aborted) {
          throw new Error('Chat stream aborted.');
        }

        // delta：累积内容 + 转发增量给前端
        if (event.type === 'delta') {
          assistantContent += event.text;
          this.writeSse(response, 'delta', {
            text: event.text,
            messageId: assistantMessage.id
          });
          continue;
        }

        // done：完成消息 + 发完成事件 + 结束
        if (event.type === 'done') {
          finishReason = event.result.finishReason ?? 'stop';
          await this.completeAssistantMessage(assistantMessage.id, assistantContent, event);
          this.writeSse(response, 'done', {
            messageId: assistantMessage.id,
            finishReason
          });
          return;
        }

        // error：失败消息 + 发错误事件 + 结束
        if (event.type === 'error') {
          await this.failAssistantMessage(assistantMessage.id, assistantContent, {
            code: event.code,
            message: event.message
          });
          this.writeSse(response, 'error', {
            code: event.code,
            message: event.message
          });
          return;
        }
      }

      // 8. 流正常结束但未收到 done 事件：兜底完成
      finishReason = finishReason ?? 'stop';
      await this.completeAssistantMessage(assistantMessage.id, assistantContent, null);
      this.writeSse(response, 'done', {
        messageId: assistantMessage.id,
        finishReason
      });
    } catch (error) {
      // 异常处理：转成错误载荷
      const errorPayload = this.toErrorPayload(error, abortController.signal.aborted);

      if (assistantMessage) {
        // 客户端中断 → stopped；其它错误 → failed
        if (abortController.signal.aborted) {
          await this.stopAssistantMessage(assistantMessage.id, assistantContent, {
            code: errorPayload.code,
            message: errorPayload.message
          });
        } else {
          await this.failAssistantMessage(assistantMessage.id, assistantContent, {
            code: errorPayload.code,
            message: errorPayload.message
          });
        }
      }

      this.writeSse(response, 'error', errorPayload);
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
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: currentUser.id,
        deletedAt: null
      },
      include: {
        character: true,
        modelConfig: true,
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
    dto: StreamChatDto,
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
        deletedAt: null
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
   * 校验模型配置就绪：必须有 apiKey。
   * @param modelConfig 模型网关配置。
   * @throws BadRequestException 未配置 apiKey（CHAT_MODEL_CONFIG_REQUIRED）。
   */
  private assertModelConfigReady(modelConfig: ModelGatewayConfig): void {
    if (!modelConfig.apiKey) {
      throw new BadRequestException({
        code: ERROR_CODES.CHAT_MODEL_CONFIG_REQUIRED,
        message: 'Model config API Key is required before chat streaming.'
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
   * 准备新对话消息：创建 user 消息 + 取历史 + 建 assistant 占位。
   * @param conversationId 会话 ID。
   * @param userMessageContent 用户消息内容。
   * @param historyLimit 历史条数限制。
   * @returns 准备好的消息集（user 消息 + assistant 占位 + 历史）。
   * @throws BadRequestException userMessage 为空。
   */
  private async prepareNewMessages(
    conversationId: string,
    userMessageContent: string | undefined,
    historyLimit: number | undefined
  ): Promise<PreparedChatStreamMessages> {
    if (!userMessageContent?.trim()) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'User message is required.'
      });
    }

    // 创建 user 消息（会更新会话 lastMessageAt）
    const currentUserMessage = await this.createUserMessage(conversationId, userMessageContent);
    // 取历史消息
    const history = await this.listRecentMessages(conversationId, historyLimit);
    // 建 assistant 占位（status=generating，内容空）
    const assistantMessage = await this.createAssistantPlaceholder(
      conversationId,
      currentUserMessage.id
    );

    return {
      currentUserMessage,
      assistantMessage,
      history
    };
  }

  /**
   * 准备重新生成消息：校验目标 → 软删原 assistant → 建新占位。
   *
   * 校验规则（与 MessagesService.assertRegenerateTarget 一致）：
   * - 目标必须是 assistant；
   * - 必须是最后一条消息；
   * - 前面必须有 user 消息。
   *
   * @param conversationId 会话 ID。
   * @param regenerateMessageId 待重新生成的消息 ID。
   * @param historyLimit 历史条数限制。
   * @returns 准备好的消息集（user 消息 + 新 assistant 占位 + 历史）。
   * @throws BadRequestException 目标不可重新生成（MESSAGE_REGENERATE_TARGET_INVALID）。
   */
  private async prepareRegenerateMessages(
    conversationId: string,
    regenerateMessageId: string,
    historyLimit: number | undefined
  ): Promise<PreparedChatStreamMessages> {
    // 取会话所有活跃消息（正序）
    const activeMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    // 定位目标消息
    const targetIndex = activeMessages.findIndex((message) => message.id === regenerateMessageId);
    const targetMessage = targetIndex === -1 ? null : activeMessages[targetIndex];

    // 校验：目标必须存在且是 assistant
    if (!targetMessage || targetMessage.role !== 'assistant') {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only assistant messages can be regenerated.'
      });
    }

    // 校验：必须是最后一条消息
    if (targetIndex !== activeMessages.length - 1) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only the latest assistant reply can be regenerated.'
      });
    }

    // 取目标前最近一条 user 消息（作为重新生成的输入）
    const currentUserMessage = activeMessages
      .slice(0, targetIndex)
      .reverse()
      .find((message) => message.role === 'user');

    if (!currentUserMessage) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Regenerate requires a previous user message.'
      });
    }

    // 事务：建新 assistant 占位（标记 regenerateOf）+ 软删原目标（标记 regeneratedBy）
    const now = new Date();
    const assistantMessage = await this.prisma.$transaction(async (tx) => {
      const replacement = await tx.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: '',
          status: 'generating',
          metadataJson: this.stringifyNullable({
            source: 'chat-stream',
            requestMessageId: currentUserMessage.id,
            regenerateOfMessageId: targetMessage.id
          } satisfies ChatMessageMetadata),
          tokenCount: null
        }
      });

      // 软删原目标消息，记录被哪条新消息替代
      await tx.message.update({
        where: { id: targetMessage.id },
        data: {
          status: 'deleted',
          deletedAt: now,
          metadataJson: this.stringifyNullable({
            ...(this.parseRecord(targetMessage.metadataJson) ?? {}),
            regeneratedAt: now.toISOString(),
            regeneratedByMessageId: replacement.id
          })
        }
      });

      return replacement;
    });
    // 取历史（不含已软删的原目标）
    const history = await this.listRecentMessages(conversationId, historyLimit);

    return {
      currentUserMessage,
      assistantMessage,
      history
    };
  }

  /**
   * 创建 user 消息（事务内同时更新会话 lastMessageAt）。
   * @param conversationId 会话 ID。
   * @param content 用户消息内容。
   * @returns 创建的 user 消息。
   */
  private async createUserMessage(conversationId: string, content: string): Promise<Message> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          role: 'user',
          content: content.trim(),
          status: 'complete',
          metadataJson: this.stringifyNullable({
            source: 'chat-stream'
          } satisfies ChatMessageMetadata),
          tokenCount: this.estimateTokens(content)
        }
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now
        }
      });

      return message;
    });
  }

  /**
   * 创建 assistant 占位消息（status=generating，内容空）。
   * @param conversationId 会话 ID。
   * @param userMessageId 触发的 user 消息 ID。
   * @returns 创建的 assistant 占位消息。
   */
  private async createAssistantPlaceholder(
    conversationId: string,
    userMessageId: string
  ): Promise<Message> {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: '',
        status: 'generating',
        metadataJson: this.stringifyNullable({
          source: 'chat-stream',
          requestMessageId: userMessageId
        }),
        tokenCount: null
      }
    });
  }

  /**
   * 完成 assistant 消息：写入最终内容 + status=complete + usage（事务内更新会话 lastMessageAt）。
   * @param assistantMessageId 消息 ID。
   * @param content 最终内容。
   * @param event 模型 done 事件（含 usage），或 null。
   * @returns 无返回值。
   */
  private async completeAssistantMessage(
    assistantMessageId: string,
    content: string,
    event: Extract<ModelGatewayStreamEvent, { type: 'done' }> | null
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.update({
        where: { id: assistantMessageId },
        data: {
          content,
          status: 'complete',
          metadataJson: this.stringifyNullable({
            source: 'chat-stream',
            finishReason: event?.result.finishReason ?? null,
            usage: event?.result.usage ?? null
          }),
          tokenCount: this.estimateTokens(content)
        }
      });

      await tx.conversation.update({
        where: { id: message.conversationId },
        data: {
          lastMessageAt: now
        }
      });
    });
  }

  /**
   * 标记 assistant 消息为失败（status=failed，记录错误）。
   * @param assistantMessageId 消息 ID。
   * @param content 已生成的内容。
   * @param error 错误信息。
   */
  private async failAssistantMessage(
    assistantMessageId: string,
    content: string,
    error: { code: string; message: string; aborted?: boolean }
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        content,
        status: 'failed',
        metadataJson: this.stringifyNullable({
          source: 'chat-stream',
          aborted: error.aborted ?? false,
          error: {
            code: error.code,
            message: error.message
          }
        } satisfies ChatMessageMetadata),
        tokenCount: this.estimateTokens(content)
      }
    });
  }

  /**
   * 标记 assistant 消息为已停止（status=stopped，客户端中断时用）。
   * @param assistantMessageId 消息 ID。
   * @param content 已生成的内容。
   * @param error 错误信息。
   */
  private async stopAssistantMessage(
    assistantMessageId: string,
    content: string,
    error: { code: string; message: string }
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        content,
        status: 'stopped',
        metadataJson: this.stringifyNullable({
          source: 'chat-stream',
          aborted: true,
          stopped: true,
          error: {
            code: error.code,
            message: error.message
          }
        } satisfies ChatMessageMetadata),
        tokenCount: this.estimateTokens(content)
      }
    });
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
    historyLimit: number | undefined
  ): Promise<Message[]> {
    const take = Math.max(1, Math.min(historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT, 100));
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        // 纳入：已完成的（complete/edited）或 user 消息（刚建的 user 也是 complete，但 OR 更保险）
        OR: [
          {
            status: {
              in: ['complete', 'edited']
            }
          },
          {
            role: 'user'
          }
        ]
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take
    });

    // 倒序取（最新在前）反转为正序（最早在前）
    return messages.reverse();
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
    modelConfig: ModelGatewayConfig;
    worldBooks: WorldBookContext[];
    dto: StreamChatDto;
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
            content: params.conversation.persona.content,
            metadata: this.parseRecord(params.conversation.persona.metadataJson)
          }
        : null,
      promptPreset: params.promptPreset
        ? {
            id: params.promptPreset.id,
            name: params.promptPreset.name,
            description: params.promptPreset.description,
            systemPrompt: params.promptPreset.systemPrompt,
            outputRules: params.promptPreset.outputRules,
            parameters: this.parseParams(params.promptPreset.parametersJson),
            metadata: this.parseRecord(params.promptPreset.metadataJson)
          }
        : null,
      modelConfig: {
        id: params.modelConfig.modelConfigId,
        name: params.conversation.modelConfig?.name ?? params.modelConfig.modelName,
        providerName: params.modelConfig.providerName,
        baseUrl: params.modelConfig.baseUrl,
        modelName: params.modelConfig.modelName,
        parameters: params.modelConfig.params,
        metadata: null
      },
      history: params.history.map((message) => this.toChatMessageLike(message)),
      currentUserMessage: this.toChatMessageLike(params.currentUserMessage),
      worldBooks: params.worldBooks,
      options: {
        mode: 'chat',
        historyLimit: params.dto.historyLimit,
        maxHistoryCharacters:
          params.dto.maxHistoryCharacters ?? PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS,
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
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
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
   * 合并模型配置参数和预设参数（预设覆盖模型配置）。
   * @param modelParams 模型配置参数。
   * @param promptPreset 预设。
   * @returns 合并后的参数。
   */
  private mergeModelParams(
    modelParams: ModelConfigParams,
    promptPreset: PromptPreset | null
  ): PromptModelParameters {
    return {
      ...modelParams,
      ...(promptPreset ? (this.parseParams(promptPreset.parametersJson) ?? {}) : {})
    };
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

  /**
   * 粗略估算 token 数（每 4 字符约 1 token）。
   * @param content 文本内容。
   * @returns 估算的 token 数。
   */
  private estimateTokens(content: string): number {
    return content.length === 0 ? 0 : Math.ceil(content.length / 4);
  }
}
