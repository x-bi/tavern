import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Character,
  Conversation,
  Message,
  ModelConfig,
  PromptPreset,
  UserPersona
} from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptBuilderService } from '../../services/prompt-builder/prompt-builder.service';
import {
  PROMPT_BUILDER_DEFAULT_HISTORY_LIMIT,
  PROMPT_BUILDER_DEFAULT_MAX_HISTORY_CHARACTERS
} from '../../services/prompt-builder/prompt-builder.constants';
import type {
  BuildPromptInput,
  ChatMessageLike,
  PromptHistoryTrimInfo,
  PromptModelParameters,
  PromptPreviewResponse,
  WorldBookContext
} from '../../services/prompt-builder/types';
import type { CurrentUser } from '../users/user.types';
import { WorldBooksService } from '../world-books/world-books.service';
import type { PreviewPromptDto } from './dto/preview-prompt.dto';

type PreviewConversation = Conversation & {
  character: Character;
  modelConfig: ModelConfig | null;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

@Injectable()
export class PromptsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PromptBuilderService)
    private readonly promptBuilder: PromptBuilderService,
    @Inject(WorldBooksService)
    private readonly worldBooksService: WorldBooksService
  ) {}

  async preview(currentUser: CurrentUser, dto: PreviewPromptDto): Promise<PromptPreviewResponse> {
    const conversation = await this.findOwnedActiveConversation(currentUser, dto.conversationId);
    const worldBooks = await this.worldBooksService.listPromptContexts(
      currentUser,
      conversation.characterId
    );
    const history = await this.listRecentMessages(
      conversation.id,
      this.resolveHistoryTake(dto.historyLimit, worldBooks)
    );
    const buildInput = this.toBuildPromptInput(currentUser, conversation, history, dto, worldBooks);
    const result = this.promptBuilder.build(buildInput);
    const historyTrimInfo = this.toHistoryTrimInfo(dto, history.length, result);

    return {
      conversationId: result.conversationId,
      generatedAt: new Date().toISOString(),
      sections: result.sections,
      logicalMessages: result.logicalMessages,
      finalMessages: result.finalMessages,
      worldBook: result.worldBook,
      historyTrimInfo,
      tokenEstimate: result.tokenEstimate,
      debug: {
        ...result.debug,
        finalMessages: result.finalMessages,
        truncatedHistory: historyTrimInfo.truncatedHistory
      }
    };
  }

  private async findOwnedActiveConversation(
    currentUser: CurrentUser,
    conversationId: string
  ): Promise<PreviewConversation> {
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

  private async listRecentMessages(
    conversationId: string,
    historyLimit: number | undefined
  ): Promise<Message[]> {
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

    return messages.reverse();
  }

  private toBuildPromptInput(
    currentUser: CurrentUser,
    conversation: PreviewConversation,
    history: Message[],
    dto: PreviewPromptDto,
    worldBooks: WorldBookContext[]
  ): BuildPromptInput {
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
            parameters: this.parseParams(conversation.promptPreset.parametersJson),
            metadata: this.parseRecord(conversation.promptPreset.metadataJson)
          }
        : null,
      modelConfig: conversation.modelConfig
        ? {
            id: conversation.modelConfig.id,
            name: conversation.modelConfig.name,
            providerName: conversation.modelConfig.provider,
            baseUrl: conversation.modelConfig.baseUrl,
            modelName: conversation.modelConfig.model,
            parameters: this.parseParams(conversation.modelConfig.defaultParamsJson),
            metadata: {
              isEnabled: conversation.modelConfig.isEnabled,
              hasApiKey: Boolean(conversation.modelConfig.apiKeyCiphertext),
              apiKeyMask: conversation.modelConfig.apiKeyMask
            }
          }
        : null,
      history: history.map((message) => this.toChatMessageLike(message)),
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
        includeDebug: true,
        supportsDeveloperRole: dto.supportsDeveloperRole
      }
    };
  }

  private toHistoryTrimInfo(
    dto: PreviewPromptDto,
    availableHistoryCount: number,
    result: ReturnType<PromptBuilderService['build']>
  ): PromptHistoryTrimInfo {
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
}
