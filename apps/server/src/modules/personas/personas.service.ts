import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type UserPersona } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { ImportModuleJsonDto } from '../../common/dto/import-module-json.dto';
import {
  createAvailableName,
  limitText,
  optionalBoolean,
  optionalRecord,
  optionalString,
  parseModuleJson,
  requiredString,
  type JsonRecord,
  type ModuleJsonImportWarning
} from '../../common/module-json-import';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ContentLibraryService } from '../content-library/content-library.service';
import type { CurrentUser } from '../users/user.types';
import type { CreatePersonaDto } from './dto/create-persona.dto';
import type { QueryPersonasDto } from './dto/query-personas.dto';
import type { UpdatePersonaDto } from './dto/update-persona.dto';
import type { PersonaListResponse, PersonaResponse } from './persona.types';

type PersonaImportPreview = {
  name: string;
  content: string;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  warnings: ModuleJsonImportWarning[];
  nameConflict: boolean;
  suggestedName: string | null;
};

type PersonaImportResponse = {
  imported: boolean;
  preview: PersonaImportPreview;
  persona: PersonaResponse | null;
};

type NormalizedPersonaImport = {
  name: string;
  content: string;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  warnings: ModuleJsonImportWarning[];
};

/**
 * 人设服务：用户人设的 CRUD + 设为默认。
 *
 * isDefault=true 时事务内保证默认唯一；软删除时改名释放唯一名约束。
 * 所有查询按 userId 隔离。
 */
@Injectable()
export class PersonasService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ContentLibraryService)
    private readonly contentLibraryService: ContentLibraryService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 分页查询当前用户的人设。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/默认过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(currentUser: CurrentUser, query: QueryPersonasDto): Promise<PersonaListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const access = await this.contentLibraryService.resolveAccess(currentUser, query.scope);
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    // 构建查询条件：限定当前用户 + 未软删除
    const where = {
      userId: access.owner.id,
      ...(query.scope === 'library' ? { isShared: true } : {}),
      deletedAt: null,
      ...(showSensitiveContent ? {} : { isSensitive: false }),
      // isDefault 未传时不加条件，传了则按值过滤
      ...(query.isDefault === undefined ? {} : { isDefault: query.isDefault }),
      // search 关键字：匹配 name/content 任一包含
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { content: { contains: query.search } }]
          }
        : {})
    };

    // 事务内并行：查当前页 + 统计总数，默认排最前
    const [items, total] = await this.prisma.$transaction([
      this.prisma.userPersona.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.userPersona.count({ where })
    ]);

    return {
      items: items.map((persona) => this.toResponse(persona, currentUser, access.ownerName)),
      total,
      page,
      pageSize
    };
  }

  /**
   * 创建人设。
   * @param currentUser 当前登录用户。
   * @param dto 创建入参。
   * @returns 创建后的人设响应。
   * @throws ConflictException 人设名重复。
   */
  async create(currentUser: CurrentUser, dto: CreatePersonaDto): Promise<PersonaResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    const data = {
      userId: currentUser.id,
      name: dto.name,
      // 可选字段未传时落库为空串；metadata 序列化成 JSON 存储
      content: dto.content ?? '',
      metadataJson: this.stringifyNullable(dto.metadata),
      isDefault: dto.isDefault ?? false,
      isSensitive: dto.isSensitive ?? false,
      isShared: dto.isShared ?? false
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认，再创建（保证默认唯一）
      const persona = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.userPersona.updateMany({
              where: {
                userId: currentUser.id,
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.userPersona.create({ data });
          })
        : await this.prisma.userPersona.create({ data });

      return this.toResponse(persona, currentUser);
    } catch (error) {
      // 捕获唯一名冲突（P2002）转成 409
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 导入 Persona JSON：commit=false 只返回预览，commit=true 才创建记录。
   * @param currentUser 当前登录用户。
   * @param dto 导入入参，含 rawJson、commit 和同名处理策略。
   * @returns PersonaImportResponse，正式导入时包含新建 Persona。
   * @throws BadRequestException JSON 非法、格式不符或含敏感字段时抛 400。
   * @throws ConflictException 同名冲突且策略为 reject 时抛 409。
   */
  async importJson(
    currentUser: CurrentUser,
    dto: ImportModuleJsonDto
  ): Promise<PersonaImportResponse> {
    const parsed = parseModuleJson(dto.rawJson, 'tavern-lite.persona.v1');
    const normalized = this.normalizePersonaImport(parsed);
    const existingNames = await this.loadExistingNames(currentUser);
    const nameConflict = existingNames.has(normalized.name);
    const suggestedName = nameConflict ? createAvailableName(normalized.name, existingNames) : null;
    const preview: PersonaImportPreview = {
      ...normalized,
      nameConflict,
      suggestedName
    };

    if (!dto.commit) {
      return {
        imported: false,
        preview,
        persona: null
      };
    }

    if (nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: ERROR_CODES.MODULE_IMPORT_NAME_EXISTS,
        message: 'Persona name already exists.',
        details: {
          suggestedName
        }
      });
    }

    const name = nameConflict && suggestedName ? suggestedName : normalized.name;

    try {
      const persona = normalized.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.userPersona.updateMany({
              where: {
                userId: currentUser.id,
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.userPersona.create({
              data: {
                userId: currentUser.id,
                name,
                content: normalized.content,
                metadataJson: this.stringifyNullable(normalized.metadata),
                isDefault: normalized.isDefault,
                isSensitive: false,
                isShared: false
              }
            });
          })
        : await this.prisma.userPersona.create({
            data: {
              userId: currentUser.id,
              name,
              content: normalized.content,
              metadataJson: this.stringifyNullable(normalized.metadata),
              isDefault: normalized.isDefault,
              isSensitive: false,
              isShared: false
            }
          });

      return {
        imported: true,
        preview: {
          ...preview,
          name
        },
        persona: this.toResponse(persona, currentUser)
      };
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async getById(currentUser: CurrentUser, id: string): Promise<PersonaResponse> {
    const persona = await this.findVisibleActivePersona(currentUser, id);
    const owner =
      persona.userId === currentUser.id ? null : await this.contentLibraryService.getOwner();
    return this.toResponse(persona, currentUser, owner?.displayName ?? null);
  }

  async fork(currentUser: CurrentUser, id: string): Promise<PersonaResponse> {
    const source = await this.findLibraryPersona(currentUser, id);
    const names = await this.loadExistingNames(currentUser);
    const persona = await this.prisma.userPersona.create({
      data: {
        userId: currentUser.id,
        name: createAvailableName(source.name, names),
        content: source.content,
        metadataJson: source.metadataJson,
        isSensitive: source.isSensitive,
        isShared: false,
        isDefault: false
      }
    });
    return this.toResponse(persona, currentUser);
  }

  /** 返回可直接用于 Persona 导入的模板。 */
  getImportTemplate() {
    return {
      fileName: 'tavern-lite-persona-template.json',
      template: {
        formatVersion: 'tavern-lite.persona.v1',
        name: '示例 Persona',
        content: '我是用户希望在对话中呈现的身份、偏好与表达方式。',
        metadata: {},
        isDefault: false
      }
    };
  }

  /**
   * 更新人设（部分更新）。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的人设响应。
   * @throws ConflictException 人设名重复。
   * @throws NotFoundException 人设不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdatePersonaDto
  ): Promise<PersonaResponse> {
    await this.contentLibraryService.assertCanSetShared(currentUser, dto.isShared);
    // 先校验人设存在且属于当前用户
    await this.findOwnedActivePersona(currentUser, id);
    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // metadata 传则整体替换
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.content === undefined ? {} : { content: dto.content }),
      ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) }),
      ...(dto.isSensitive === undefined ? {} : { isSensitive: dto.isSensitive }),
      ...(dto.isShared === undefined ? {} : { isShared: dto.isShared }),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认（排除自身），再更新
      const persona = dto.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.userPersona.updateMany({
              where: {
                userId: currentUser.id,
                id: {
                  not: id
                },
                deletedAt: null,
                isDefault: true
              },
              data: {
                isDefault: false
              }
            });

            return tx.userPersona.update({
              where: { id },
              data
            });
          })
        : await this.prisma.userPersona.update({
            where: { id },
            data
          });

      if (dto.isSensitive !== undefined) {
        await this.refreshConversationSensitivityForPersona(currentUser, id, dto.isSensitive);
      }

      return this.toResponse(persona, currentUser);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 删除人设（软删除）：改名释放唯一名约束 + 取消默认 + 标记删除时间。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 人设不存在或不属于该用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActivePersona(currentUser, id);

    await this.prisma.userPersona.update({
      where: { id },
      data: {
        name: `${existing.name}__deleted__${existing.id}`,
        isDefault: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  /**
   * 将指定人设设为默认（事务内先取消其它默认，再设本条为默认）。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID。
   * @returns 设为默认后的人设响应。
   * @throws NotFoundException 人设不存在或不属于当前用户。
   */
  async setDefault(currentUser: CurrentUser, id: string): Promise<PersonaResponse> {
    // 先校验人设存在且属于当前用户
    await this.findOwnedActivePersona(currentUser, id);

    // 事务：先取消该用户其它默认，再设本条为默认
    const persona = await this.prisma.$transaction(async (tx) => {
      await tx.userPersona.updateMany({
        where: {
          userId: currentUser.id,
          id: {
            not: id
          },
          deletedAt: null,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });

      return tx.userPersona.update({
        where: { id },
        data: {
          isDefault: true
        }
      });
    });

    return this.toResponse(persona, currentUser);
  }

  /**
   * 归一化 Persona 导入 JSON。
   * @param record 原始 JSON 对象。
   * @returns 可写入数据库的 Persona 导入数据。
   */
  private normalizePersonaImport(record: JsonRecord): NormalizedPersonaImport {
    const warnings: ModuleJsonImportWarning[] = [];
    const name = limitText(requiredString(record, 'name', 'name'), 120, 'name', warnings);
    const content = limitText(
      optionalString(record, 'content', 'content') ?? '',
      10000,
      'content',
      warnings
    );

    return {
      name,
      content,
      metadata: optionalRecord(record, 'metadata', 'metadata'),
      isDefault: optionalBoolean(record, 'isDefault', false, 'isDefault'),
      warnings
    };
  }

  /**
   * 读取当前用户已有 Persona 名称集合。
   * @param currentUser 当前登录用户。
   * @returns 当前用户未删除 Persona 的名称集合。
   */
  private async loadExistingNames(currentUser: CurrentUser): Promise<Set<string>> {
    const items = await this.prisma.userPersona.findMany({
      where: {
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        name: true
      }
    });

    return new Set(items.map((item) => item.name));
  }

  /**
   * 查询人设并校验所有权：限定 id + 当前用户 + 未删除。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID。
   * @returns 校验通过的人设记录。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActivePersona(currentUser: CurrentUser, id: string): Promise<UserPersona> {
    const persona = await this.prisma.userPersona.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      }
    });

    if (!persona) {
      throw new NotFoundException({
        code: ERROR_CODES.PERSONA_NOT_FOUND,
        message: 'Persona not found.'
      });
    }

    return persona;
  }

  private async findVisibleActivePersona(
    currentUser: CurrentUser,
    id: string
  ): Promise<UserPersona> {
    const owner = await this.contentLibraryService.getOwner();
    const persona = await this.prisma.userPersona.findFirst({
      where: {
        id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false }),
        OR: [{ userId: currentUser.id }, { userId: owner.id, isShared: true }]
      }
    });
    if (!persona)
      throw new NotFoundException({
        code: ERROR_CODES.PERSONA_NOT_FOUND,
        message: 'Persona not found.'
      });
    return persona;
  }

  private async findLibraryPersona(currentUser: CurrentUser, id: string): Promise<UserPersona> {
    const owner = await this.contentLibraryService.getOwner();
    const persona = await this.prisma.userPersona.findFirst({
      where: {
        id,
        userId: owner.id,
        isShared: true,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      }
    });
    if (!persona)
      throw new NotFoundException({
        code: ERROR_CODES.CONTENT_LIBRARY_ITEM_NOT_FOUND,
        message: 'Shared persona not found.'
      });
    return persona;
  }

  /**
   * 数据库记录 → 对外响应（解析 metadata JSON、格式化时间）。
   * @param persona 人设数据库记录。
   * @returns 人设响应。
   */
  private toResponse(
    persona: UserPersona,
    currentUser: CurrentUser,
    ownerName: string | null = null
  ): PersonaResponse {
    const isOwner = persona.userId === currentUser.id;
    return {
      id: persona.id,
      userId: persona.userId,
      name: persona.name,
      content: persona.content,
      metadata: this.parseRecord(persona.metadataJson),
      isDefault: persona.isDefault,
      isSensitive: persona.isSensitive,
      isShared: persona.isShared,
      isOwner,
      ownerName,
      canFork: !isOwner && persona.isShared,
      createdAt: persona.createdAt.toISOString(),
      updatedAt: persona.updatedAt.toISOString()
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

  /**
   * 若是 Prisma 唯一约束冲突（P2002），转成 409 人设名重复；否则什么都不做。
   * @param error 捕获的异常。
   */
  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.PERSONA_NAME_EXISTS,
        message: 'Persona name already exists.'
      });
    }
  }

  private async refreshConversationSensitivityForPersona(
    currentUser: CurrentUser,
    personaId: string,
    isSensitive: boolean
  ): Promise<void> {
    if (isSensitive) {
      await this.prisma.conversation.updateMany({
        where: {
          userId: currentUser.id,
          personaId,
          deletedAt: null
        },
        data: {
          usesSensitiveResource: true
        }
      });
      return;
    }

    await this.prisma.conversation.updateMany({
      where: {
        userId: currentUser.id,
        personaId,
        deletedAt: null,
        character: {
          isSensitive: false
        },
        persona: {
          isSensitive: false
        },
        OR: [{ promptPresetId: null }, { promptPreset: { is: { isSensitive: false } } }]
      },
      data: {
        usesSensitiveResource: false
      }
    });
  }
}
