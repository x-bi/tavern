import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type Asset,
  type Character,
  type Conversation,
  type ModelConfig,
  type PromptPreset,
  type UserPersona
} from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type {
  ConversationClearResponse,
  ConversationListResponse,
  ConversationResponse
} from './conversation.types';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { QueryConversationsDto } from './dto/query-conversations.dto';
import type { UpdateConversationDto } from './dto/update-conversation.dto';

type ConversationWithRelations = Conversation & {
  character: Character & {
    avatarAsset: Asset | null;
  };
  modelConfig: ModelConfig | null;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async list(
    currentUser: CurrentUser,
    query: QueryConversationsDto
  ): Promise<ConversationListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ConversationWhereInput = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.characterId === undefined ? {} : { characterId: query.characterId }),
      ...(query.modelConfigId === undefined ? {} : { modelConfigId: query.modelConfigId }),
      ...(query.promptPresetId === undefined ? {} : { promptPresetId: query.promptPresetId }),
      ...(query.personaId === undefined ? {} : { personaId: query.personaId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              {
                character: {
                  name: {
                    contains: query.search
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: this.relationInclude(),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.conversation.count({ where })
    ]);

    return {
      items: items.map((conversation) => this.toResponse(conversation)),
      total,
      page,
      pageSize
    };
  }

  async create(
    currentUser: CurrentUser,
    dto: CreateConversationDto
  ): Promise<ConversationResponse> {
    await this.resolveCharacterId(currentUser, dto.characterId);
    const modelConfigId = await this.resolveModelConfigId(currentUser, dto.modelConfigId);
    const promptPresetId = await this.resolvePromptPresetId(currentUser, dto.promptPresetId);
    const personaId = await this.resolvePersonaId(currentUser, dto.personaId);

    const conversation = await this.prisma.conversation.create({
      data: {
        userId: currentUser.id,
        characterId: dto.characterId,
        modelConfigId,
        promptPresetId,
        personaId,
        title: dto.title,
        status: dto.status ?? 'active',
        metadataJson: this.stringifyNullable(dto.metadata)
      },
      include: this.relationInclude()
    });

    return this.toResponse(conversation);
  }

  async getById(currentUser: CurrentUser, id: string): Promise<ConversationResponse> {
    return this.toResponse(await this.findOwnedActiveConversation(currentUser, id));
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateConversationDto
  ): Promise<ConversationResponse> {
    await this.findOwnedActiveConversation(currentUser, id);
    const characterId =
      dto.characterId === undefined
        ? undefined
        : await this.resolveCharacterId(currentUser, dto.characterId);
    const modelConfigId =
      dto.modelConfigId === undefined
        ? undefined
        : await this.resolveModelConfigId(currentUser, dto.modelConfigId);
    const promptPresetId =
      dto.promptPresetId === undefined
        ? undefined
        : await this.resolvePromptPresetId(currentUser, dto.promptPresetId);
    const personaId =
      dto.personaId === undefined
        ? undefined
        : await this.resolvePersonaId(currentUser, dto.personaId);

    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(characterId === undefined ? {} : { characterId }),
        ...(modelConfigId === undefined ? {} : { modelConfigId }),
        ...(promptPresetId === undefined ? {} : { promptPresetId }),
        ...(personaId === undefined ? {} : { personaId }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) })
      },
      include: this.relationInclude()
    });

    return this.toResponse(conversation);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveConversation(currentUser, id);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id },
        data: {
          status: 'archived',
          deletedAt: now
        }
      }),
      this.prisma.message.updateMany({
        where: {
          conversationId: id,
          deletedAt: null
        },
        data: {
          deletedAt: now
        }
      })
    ]);

    return {
      deleted: true,
      id
    };
  }

  async clear(currentUser: CurrentUser, id: string): Promise<ConversationClearResponse> {
    await this.findOwnedActiveConversation(currentUser, id);
    const now = new Date();
    const [, messages] = await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: null
        }
      }),
      this.prisma.message.updateMany({
        where: {
          conversationId: id,
          deletedAt: null
        },
        data: {
          deletedAt: now
        }
      })
    ]);

    return {
      cleared: true,
      id,
      deletedMessages: messages.count
    };
  }

  private async findOwnedActiveConversation(
    currentUser: CurrentUser,
    id: string
  ): Promise<ConversationWithRelations> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      include: this.relationInclude()
    });

    if (!conversation) {
      throw new NotFoundException({
        code: ERROR_CODES.CONVERSATION_NOT_FOUND,
        message: 'Conversation not found.'
      });
    }

    return conversation;
  }

  private async resolveCharacterId(currentUser: CurrentUser, id: string): Promise<string> {
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!character) {
      throw new BadRequestException({
        code: ERROR_CODES.CHARACTER_NOT_FOUND,
        message: 'Character not found.'
      });
    }

    return character.id;
  }

  private async resolveModelConfigId(
    currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<string | null> {
    if (!id) {
      return null;
    }

    const modelConfig = await this.prisma.modelConfig.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!modelConfig) {
      throw new BadRequestException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model config not found.'
      });
    }

    return modelConfig.id;
  }

  private async resolvePromptPresetId(
    currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<string | null> {
    if (!id) {
      return null;
    }

    const promptPreset = await this.prisma.promptPreset.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!promptPreset) {
      throw new BadRequestException({
        code: ERROR_CODES.PROMPT_PRESET_NOT_FOUND,
        message: 'Prompt preset not found.'
      });
    }

    return promptPreset.id;
  }

  private async resolvePersonaId(
    currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<string | null> {
    if (!id) {
      return null;
    }

    const persona = await this.prisma.userPersona.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!persona) {
      throw new BadRequestException({
        code: ERROR_CODES.PERSONA_NOT_FOUND,
        message: 'Persona not found.'
      });
    }

    return persona.id;
  }

  private relationInclude() {
    return {
      character: {
        include: {
          avatarAsset: true
        }
      },
      modelConfig: true,
      promptPreset: true,
      persona: true
    } satisfies Prisma.ConversationInclude;
  }

  private toResponse(conversation: ConversationWithRelations): ConversationResponse {
    return {
      id: conversation.id,
      userId: conversation.userId,
      characterId: conversation.characterId,
      modelConfigId: conversation.modelConfigId,
      promptPresetId: conversation.promptPresetId,
      personaId: conversation.personaId,
      title: conversation.title,
      status: conversation.status,
      metadata: this.parseRecord(conversation.metadataJson),
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      character: {
        id: conversation.character.id,
        name: conversation.character.name,
        avatarAssetId: conversation.character.avatarAssetId,
        avatarUrl: conversation.character.avatarAsset?.publicPath ?? null
      },
      persona: conversation.persona
        ? {
            id: conversation.persona.id,
            name: conversation.persona.name
          }
        : null,
      modelConfig: conversation.modelConfig
        ? {
            id: conversation.modelConfig.id,
            name: conversation.modelConfig.name,
            providerName: conversation.modelConfig.provider,
            baseUrl: conversation.modelConfig.baseUrl,
            modelName: conversation.modelConfig.model,
            apiKeyMask: conversation.modelConfig.apiKeyMask,
            hasApiKey: Boolean(conversation.modelConfig.apiKeyCiphertext),
            isEnabled: conversation.modelConfig.isEnabled
          }
        : null,
      promptPreset: conversation.promptPreset
        ? {
            id: conversation.promptPreset.id,
            name: conversation.promptPreset.name
          }
        : null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    };
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private parseRecord(value: string | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
