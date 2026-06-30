import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type UserPersona } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { CreatePersonaDto } from './dto/create-persona.dto';
import type { QueryPersonasDto } from './dto/query-personas.dto';
import type { UpdatePersonaDto } from './dto/update-persona.dto';
import type { PersonaListResponse, PersonaResponse } from './persona.types';

@Injectable()
export class PersonasService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async list(currentUser: CurrentUser, query: QueryPersonasDto): Promise<PersonaListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isDefault === undefined ? {} : { isDefault: query.isDefault }),
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { content: { contains: query.search } }]
          }
        : {})
    };

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

  async create(currentUser: CurrentUser, dto: CreatePersonaDto): Promise<PersonaResponse> {
    const data = {
      userId: currentUser.id,
      name: dto.name,
      content: dto.content ?? '',
      metadataJson: this.stringifyNullable(dto.metadata),
      isDefault: dto.isDefault ?? false
    };

    try {
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
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdatePersonaDto
  ): Promise<PersonaResponse> {
    await this.findOwnedActivePersona(currentUser, id);
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.content === undefined ? {} : { content: dto.content }),
      ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) }),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
    };

    try {
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

  async setDefault(currentUser: CurrentUser, id: string): Promise<PersonaResponse> {
    await this.findOwnedActivePersona(currentUser, id);

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

  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.PERSONA_NAME_EXISTS,
        message: 'Persona name already exists.'
      });
    }
  }
}
