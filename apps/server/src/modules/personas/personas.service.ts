import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type UserPersona } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { CreatePersonaDto } from './dto/create-persona.dto';
import type { QueryPersonasDto } from './dto/query-personas.dto';
import type { UpdatePersonaDto } from './dto/update-persona.dto';
import type { PersonaListResponse, PersonaResponse } from './persona.types';

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
    private readonly prisma: PrismaService
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
    // 构建查询条件：限定当前用户 + 未软删除
    const where = {
      userId: currentUser.id,
      deletedAt: null,
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
      items: items.map((persona) => this.toResponse(persona)),
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
    const data = {
      userId: currentUser.id,
      name: dto.name,
      // 可选字段未传时落库为空串；metadata 序列化成 JSON 存储
      content: dto.content ?? '',
      metadataJson: this.stringifyNullable(dto.metadata),
      isDefault: dto.isDefault ?? false
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

      return this.toResponse(persona);
    } catch (error) {
      // 捕获唯一名冲突（P2002）转成 409
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
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
    // 先校验人设存在且属于当前用户
    await this.findOwnedActivePersona(currentUser, id);
    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // metadata 传则整体替换
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.content === undefined ? {} : { content: dto.content }),
      ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) }),
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

      return this.toResponse(persona);
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

    return this.toResponse(persona);
  }

  /**
   * 查询人设并校验所有权：限定 id + 当前用户 + 未删除。
   * @param currentUser 当前登录用户。
   * @param id 人设 ID。
   * @returns 校验通过的人设记录。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActivePersona(
    currentUser: CurrentUser,
    id: string
  ): Promise<UserPersona> {
    const persona = await this.prisma.userPersona.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
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

  /**
   * 数据库记录 → 对外响应（解析 metadata JSON、格式化时间）。
   * @param persona 人设数据库记录。
   * @returns 人设响应。
   */
  private toResponse(persona: UserPersona): PersonaResponse {
    return {
      id: persona.id,
      userId: persona.userId,
      name: persona.name,
      content: persona.content,
      metadata: this.parseRecord(persona.metadataJson),
      isDefault: persona.isDefault,
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
}
