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

type PreparedChatStreamMessages = {
  currentUserMessage: Message;
  assistantMessage: Message;
  history: Message[];
};

@Injectable()
export class ChatService {
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

  async stream(
    currentUser: CurrentUser,
    dto: StreamChatDto,
    response: ChatResponseLike
  ): Promise<void> {
    this.prepareSseResponse(response);

    const abortController = new AbortController();
    let streamFinished = false;
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
      task = this.acquireConversationTask(dto.conversationId, abortController);
      this.assertStreamMode(dto);
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

      this.assertModelConfigReady(modelConfig);

      const preparedMessages = dto.regenerateMessageId
        ? await this.prepareRegenerateMessages(
            conversation.id,
            dto.regenerateMessageId,
            historyTake
          )
        : await this.prepareNewMessages(conversation.id, dto.userMessage, historyTake);

      assistantMessage = preparedMessages.assistantMessage;
      task.assistantMessageId = assistantMessage.id;

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

      for await (const event of this.modelGateway.streamChat(prompt.finalMessages, {
        providerName: modelConfig.providerName,
        baseUrl: modelConfig.baseUrl,
        modelName: modelConfig.modelName,
        apiKey: modelConfig.apiKey,
        signal: abortController.signal,
        ...this.mergeModelParams(modelConfig.params, promptPreset)
      })) {
        if (abortController.signal.aborted) {
          throw new Error('Chat stream aborted.');
        }

        if (event.type === 'delta') {
          assistantContent += event.text;
          this.writeSse(response, 'delta', {
            text: event.text,
            messageId: assistantMessage.id
          });
          continue;
        }

        if (event.type === 'done') {
          finishReason = event.result.finishReason ?? 'stop';
          await this.completeAssistantMessage(assistantMessage.id, assistantContent, event);
          this.writeSse(response, 'done', {
            messageId: assistantMessage.id,
            finishReason
          });
          return;
        }

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

      finishReason = finishReason ?? 'stop';
      await this.completeAssistantMessage(assistantMessage.id, assistantContent, null);
      this.writeSse(response, 'done', {
        messageId: assistantMessage.id,
        finishReason
      });
    } catch (error) {
      const errorPayload = this.toErrorPayload(error, abortController.signal.aborted);

      if (assistantMessage) {
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

  private prepareSseResponse(response: ChatResponseLike): void {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
  }

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

  private releaseConversationTask(task: ChatTask): void {
    if (this.conversationTasks.get(task.conversationId) === task) {
      this.conversationTasks.delete(task.conversationId);
    }
  }

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

  private async resolvePromptPreset(
    currentUser: CurrentUser,
    dto: StreamChatDto,
    conversation: ChatConversation
  ): Promise<PromptPreset | null> {
    if (dto.presetId === undefined) {
      return conversation.promptPreset;
    }

    if (!dto.presetId) {
      return null;
    }

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

  private assertModelConfigReady(modelConfig: ModelGatewayConfig): void {
    if (!modelConfig.apiKey) {
      throw new BadRequestException({
        code: ERROR_CODES.CHAT_MODEL_CONFIG_REQUIRED,
        message: 'Model config API Key is required before chat streaming.'
      });
    }
  }

  private assertStreamMode(dto: StreamChatDto): void {
    const hasUserMessage = typeof dto.userMessage === 'string' && dto.userMessage.trim().length > 0;
    const hasRegenerateMessage = Boolean(dto.regenerateMessageId);

    if (hasUserMessage === hasRegenerateMessage) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Provide either userMessage or regenerateMessageId.'
      });
    }
  }

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

    const currentUserMessage = await this.createUserMessage(conversationId, userMessageContent);
    const history = await this.listRecentMessages(conversationId, historyLimit);
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

  private async prepareRegenerateMessages(
    conversationId: string,
    regenerateMessageId: string,
    historyLimit: number | undefined
  ): Promise<PreparedChatStreamMessages> {
    const activeMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const targetIndex = activeMessages.findIndex((message) => message.id === regenerateMessageId);
    const targetMessage = targetIndex === -1 ? null : activeMessages[targetIndex];

    if (!targetMessage || targetMessage.role !== 'assistant') {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only assistant messages can be regenerated.'
      });
    }

    if (targetIndex !== activeMessages.length - 1) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only the latest assistant reply can be regenerated.'
      });
    }

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
    const history = await this.listRecentMessages(conversationId, historyLimit);

    return {
      currentUserMessage,
      assistantMessage,
      history
    };
  }

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

  private async listRecentMessages(
    conversationId: string,
    historyLimit: number | undefined
  ): Promise<Message[]> {
    const take = Math.max(1, Math.min(historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT, 100));
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
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

    return messages.reverse();
  }

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

  private resolveHistoryTake(
    historyLimit: number | undefined,
    worldBooks: WorldBookContext[]
  ): number {
    const promptHistoryLimit = historyLimit ?? PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT;
    const worldBookScanDepth = worldBooks.reduce(
      (maxDepth, worldBook) =>
        worldBook.isEnabled ? Math.max(maxDepth, worldBook.scanDepth) : maxDepth,
      0
    );

    return Math.max(promptHistoryLimit, worldBookScanDepth);
  }

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

  private mergeModelParams(
    modelParams: ModelConfigParams,
    promptPreset: PromptPreset | null
  ): PromptModelParameters {
    return {
      ...modelParams,
      ...(promptPreset ? (this.parseParams(promptPreset.parametersJson) ?? {}) : {})
    };
  }

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

  private parseRecord(value: string | null): Record<string, unknown> | null {
    const parsed = this.parseJson(value);

    return this.isRecord(parsed) ? parsed : null;
  }

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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private estimateTokens(content: string): number {
    return content.length === 0 ? 0 : Math.ceil(content.length / 4);
  }
}
