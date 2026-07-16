import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type Asset,
  type Character,
  type Conversation,
  type ModelFallbackGroup,
  type ModelFallbackCandidate,
  type PromptPreset,
  type UserPersona
} from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUser } from '../users/user.types';
import type {
  ConversationClearResponse,
  ConversationListResponse,
  ConversationResponse
} from './conversation.types';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { QueryConversationsDto } from './dto/query-conversations.dto';
import type { UpdateConversationDto } from './dto/update-conversation.dto';

/** 会话记录 + 各关联实体（include 后的形态）。 */
type ConversationWithRelations = Conversation & {
  character: Character & {
    avatarAsset: Asset | null;
  };
  modelFallbackGroup:
    | (ModelFallbackGroup & {
        candidates: ModelFallbackCandidate[];
      })
    | null;
  promptPreset: PromptPreset | null;
  persona: UserPersona | null;
};

/**
 * 会话服务：会话的 CRUD、清空消息、级联软删除。
 *
 * 会话关联角色/模型配置/预设/人设四类实体，创建/更新时校验这些关联实体的归属。
 * 删除时级联软删除其下所有消息；清空时只删消息保留会话。
 * 所有查询按 userId 隔离。
 */
@Injectable()
export class ConversationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 分页查询当前用户的会话。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/关联/状态过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(
    currentUser: CurrentUser,
    query: QueryConversationsDto
  ): Promise<ConversationListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    // 构建查询条件：限定当前用户 + 未软删除
    const where: Prisma.ConversationWhereInput = {
      userId: currentUser.id,
      deletedAt: null,
      ...(showSensitiveContent ? {} : { usesSensitiveResource: false }),
      // 各关联 ID 未传时不加条件，传了则按值过滤
      ...(query.characterId === undefined ? {} : { characterId: query.characterId }),
      ...(query.modelFallbackGroupId === undefined
        ? {}
        : { modelFallbackGroupId: query.modelFallbackGroupId }),
      ...(query.promptPresetId === undefined ? {} : { promptPresetId: query.promptPresetId }),
      ...(query.personaId === undefined ? {} : { personaId: query.personaId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      // search 关键字：匹配 title 或关联角色 name 包含
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

    // 事务内并行：查当前页（含关联）+ 统计总数，按最后消息时间倒序
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

  /**
   * 创建会话：先校验各关联实体归属，再创建。
   * @param currentUser 当前登录用户。
   * @param dto 创建入参。
   * @returns 创建后的会话响应（含关联）。
   * @throws BadRequestException 关联的角色/模型配置/预设/人设不存在或不属于该用户。
   */
  async create(
    currentUser: CurrentUser,
    dto: CreateConversationDto
  ): Promise<ConversationResponse> {
    // 逐一校验关联实体归属（characterId 必填，其余可选）
    await this.resolveCharacterId(currentUser, dto.characterId);
    const modelFallbackGroupId = await this.resolveModelFallbackGroupId(
      currentUser,
      dto.modelFallbackGroupId
    );
    const promptPresetId = await this.resolvePromptPresetId(currentUser, dto.promptPresetId);
    const personaId = await this.resolvePersonaId(currentUser, dto.personaId);
    const usesSensitiveResource = await this.calculateUsesSensitiveResource(currentUser, {
      characterId: dto.characterId,
      promptPresetId,
      personaId
    });

    const conversation = await this.prisma.conversation.create({
      data: {
        userId: currentUser.id,
        characterId: dto.characterId,
        modelFallbackGroupId,
        promptPresetId,
        personaId,
        title: dto.title,
        status: dto.status ?? 'active',
        usesSensitiveResource,
        metadataJson: this.stringifyNullable(dto.metadata)
      },
      include: this.relationInclude()
    });

    return this.toResponse(conversation);
  }

  /**
   * 获取单个会话（含关联）。
   * @param currentUser 当前登录用户。
   * @param id 会话 ID。
   * @returns 会话响应（含关联）。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  async getById(currentUser: CurrentUser, id: string): Promise<ConversationResponse> {
    return this.toResponse(await this.findOwnedActiveConversation(currentUser, id));
  }

  /**
   * 更新会话（部分更新）：关联 ID 传入时校验归属。
   * @param currentUser 当前登录用户。
   * @param id 会话 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的会话响应（含关联）。
   * @throws BadRequestException 传入的关联实体不存在或不属于该用户。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateConversationDto
  ): Promise<ConversationResponse> {
    // 先校验会话存在且属于当前用户
    const existing = await this.findOwnedActiveConversation(currentUser, id);
    // 各关联 ID：未传(undefined)不动，传了则校验归属（null 表示解绑，不需校验）
    const characterId =
      dto.characterId === undefined
        ? undefined
        : await this.resolveCharacterId(currentUser, dto.characterId);
    const modelFallbackGroupId =
      dto.modelFallbackGroupId === undefined
        ? undefined
        : await this.resolveModelFallbackGroupId(currentUser, dto.modelFallbackGroupId);
    const promptPresetId =
      dto.promptPresetId === undefined
        ? undefined
        : await this.resolvePromptPresetId(currentUser, dto.promptPresetId);
    const personaId =
      dto.personaId === undefined
        ? undefined
        : await this.resolvePersonaId(currentUser, dto.personaId);
    const nextCharacterId = characterId === undefined ? existing.characterId : characterId;
    const nextPromptPresetId =
      promptPresetId === undefined ? existing.promptPresetId : promptPresetId;
    const nextPersonaId = personaId === undefined ? existing.personaId : personaId;
    const usesSensitiveResource = await this.calculateUsesSensitiveResource(currentUser, {
      characterId: nextCharacterId,
      promptPresetId: nextPromptPresetId,
      personaId: nextPersonaId
    });

    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(characterId === undefined ? {} : { characterId }),
        ...(modelFallbackGroupId === undefined ? {} : { modelFallbackGroupId }),
        ...(promptPresetId === undefined ? {} : { promptPresetId }),
        ...(personaId === undefined ? {} : { personaId }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        usesSensitiveResource,
        ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) })
      },
      include: this.relationInclude()
    });

    return this.toResponse(conversation);
  }

  /**
   * 删除会话（级联软删除）。
   *
   * 事务内：会话标记归档+删除时间，其下未删除的消息全部软删除。
   * @param currentUser 当前登录用户。
   * @param id 会话 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
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
      // 级联软删除该会话下所有未删除的消息
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

  /**
   * 清空会话消息（保留会话本身）。
   *
   * 事务内：重置会话的 lastMessageAt，软删除其下所有消息，返回删除条数。
   * @param currentUser 当前登录用户。
   * @param id 会话 ID。
   * @returns 含被删除的消息数 deletedMessages。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  async clear(currentUser: CurrentUser, id: string): Promise<ConversationClearResponse> {
    await this.findOwnedActiveConversation(currentUser, id);
    const now = new Date();
    // 事务：重置最后消息时间 + 软删除所有消息；第二个返回值含 count
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

  /**
   * 查询会话并校验所有权：限定 id + 当前用户 + 未删除（含关联）。
   * @param currentUser 当前登录用户。
   * @param id 会话 ID。
   * @returns 校验通过的会话记录（含关联）。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActiveConversation(
    currentUser: CurrentUser,
    id: string
  ): Promise<ConversationWithRelations> {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { usesSensitiveResource: false })
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

  /**
   * 校验角色归属并返回其 ID（角色必须属于当前用户）。
   * @param currentUser 当前登录用户。
   * @param id 角色 ID。
   * @returns 校验通过的角色 ID。
   * @throws BadRequestException 角色不存在或不属于该用户。
   */
  private async resolveCharacterId(currentUser: CurrentUser, id: string): Promise<string> {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
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

  /**
   * 校验模型链归属并返回其 ID；传空值不校验返回 null。
   * @param currentUser 当前登录用户。
   * @param id 模型链 ID，为空返回 null。
   * @returns 校验通过的模型链 ID，或 null。
   */
  private async resolveModelFallbackGroupId(
    _currentUser: CurrentUser,
    id: string | null | undefined
  ): Promise<string | null> {
    if (!id) {
      return null;
    }

    const group = await this.prisma.modelFallbackGroup.findFirst({
      where: {
        id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!group) {
      throw new BadRequestException({
        code: ERROR_CODES.MODEL_CONFIG_NOT_FOUND,
        message: 'Model fallback group not found.'
      });
    }

    return group.id;
  }

  /**
   * 校验预设归属并返回其 ID；传空值不校验返回 null。
   * @param currentUser 当前登录用户。
   * @param id 预设 ID，为空返回 null。
   * @returns 校验通过的预设 ID，或 null。
   * @throws BadRequestException 预设不存在或不属于该用户。
   */
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
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
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

  /**
   * 校验人设归属并返回其 ID；传空值不校验返回 null。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID，为空返回 null。
   * @returns 校验通过的人设 ID，或 null。
   * @throws BadRequestException 人设不存在或不属于该用户。
   */
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
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
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

  /**
   * 会话查询时 include 的关联结构（角色含头像、模型配置、预设、人设）。
   * @returns Prisma 关联查询配置对象。
   */
  private relationInclude() {
    return {
      character: {
        include: {
          avatarAsset: true
        }
      },
      modelFallbackGroup: {
        include: {
          candidates: true
        }
      },
      promptPreset: true,
      persona: true
    } satisfies Prisma.ConversationInclude;
  }

  /**
   * 数据库记录 → 对外响应（组装各关联摘要、解析 metadata、格式化时间）。
   * @param conversation 会话记录（含关联）。
   * @returns 会话响应。
   */
  private toResponse(conversation: ConversationWithRelations): ConversationResponse {
    return {
      id: conversation.id,
      userId: conversation.userId,
      characterId: conversation.characterId,
      modelFallbackGroupId: conversation.modelFallbackGroupId,
      promptPresetId: conversation.promptPresetId,
      personaId: conversation.personaId,
      title: conversation.title,
      status: conversation.status,
      metadata: this.parseRecord(conversation.metadataJson),
      usesSensitiveResource: conversation.usesSensitiveResource,
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
      modelFallbackGroup: conversation.modelFallbackGroup
        ? {
            id: conversation.modelFallbackGroup.id,
            name: conversation.modelFallbackGroup.name,
            isEnabled: conversation.modelFallbackGroup.isEnabled,
            candidateCount: conversation.modelFallbackGroup.candidates.length
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

  /**
   * 把结构化数据序列化成 JSON 字符串；undefined/null 返回 null。
   * @param value 任意值。
   * @returns JSON 字符串，undefined/null 返回 null。
   */
  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  /**
   * 解析 metadataJson 为对象；为空/非对象/解析失败返回 null。
   * @param value metadataJson 字符串。
   * @returns 解析后的对象，或 null。
   */
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

  private async calculateUsesSensitiveResource(
    currentUser: CurrentUser,
    refs: {
      characterId: string;
      promptPresetId: string | null;
      personaId: string | null;
    }
  ): Promise<boolean> {
    const [character, promptPreset, persona] = await Promise.all([
      this.prisma.character.findFirst({
        where: {
          id: refs.characterId,
          userId: currentUser.id,
          deletedAt: null
        },
        select: {
          isSensitive: true
        }
      }),
      refs.promptPresetId
        ? this.prisma.promptPreset.findFirst({
            where: {
              id: refs.promptPresetId,
              userId: currentUser.id,
              deletedAt: null
            },
            select: {
              isSensitive: true
            }
          })
        : Promise.resolve(null),
      refs.personaId
        ? this.prisma.userPersona.findFirst({
            where: {
              id: refs.personaId,
              userId: currentUser.id,
              deletedAt: null
            },
            select: {
              isSensitive: true
            }
          })
        : Promise.resolve(null)
    ]);

    return Boolean(character?.isSensitive || promptPreset?.isSensitive || persona?.isSensitive);
  }
}
