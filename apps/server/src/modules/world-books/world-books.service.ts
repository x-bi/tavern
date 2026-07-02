import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Character, WorldBook, WorldBookEntry } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { CreateWorldBookEntryDto } from './dto/create-world-book-entry.dto';
import type { CreateWorldBookDto } from './dto/create-world-book.dto';
import type { QueryWorldBooksDto } from './dto/query-world-books.dto';
import type { UpdateWorldBookEntryDto } from './dto/update-world-book-entry.dto';
import type { UpdateWorldBookDto } from './dto/update-world-book.dto';
import { WORLD_BOOK_ENTRY_INSERTION_ORDERS } from './world-books.constants';
import type {
  WorldBookEntryInsertionOrder,
  WorldBookEntryResponse,
  WorldBookListResponse,
  WorldBookResponse
} from './world-book.types';

type WorldBookWithEntries = WorldBook & {
  entries: WorldBookEntry[];
};

type WorldBookEntryWithBook = WorldBookEntry & {
  worldBook: WorldBook;
};

@Injectable()
export class WorldBooksService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async list(currentUser: CurrentUser, query: QueryWorldBooksDto): Promise<WorldBookListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.characterId === undefined ? {} : { characterId: query.characterId }),
      ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.worldBook.findMany({
        where,
        include: {
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.worldBook.count({ where })
    ]);

    return {
      items: items.map((worldBook) => this.toWorldBookResponse(worldBook)),
      total,
      page,
      pageSize
    };
  }

  async create(currentUser: CurrentUser, dto: CreateWorldBookDto): Promise<WorldBookResponse> {
    const characterId = await this.resolveCharacterId(currentUser, dto.characterId);
    const worldBook = await this.prisma.worldBook.create({
      data: {
        userId: currentUser.id,
        characterId,
        name: dto.name,
        description: dto.description ?? '',
        isEnabled: dto.isEnabled ?? true,
        scanDepth: dto.scanDepth ?? 6,
        tokenBudget: dto.tokenBudget ?? 1000,
        metadataJson: this.stringifyNullable(dto.metadata)
      },
      include: {
        entries: true
      }
    });

    return this.toWorldBookResponse(worldBook);
  }

  async getById(currentUser: CurrentUser, id: string): Promise<WorldBookResponse> {
    return this.toWorldBookResponse(await this.findOwnedActiveWorldBook(currentUser, id));
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateWorldBookDto
  ): Promise<WorldBookResponse> {
    await this.findOwnedActiveWorldBook(currentUser, id);
    const characterId =
      dto.characterId === undefined
        ? undefined
        : await this.resolveCharacterId(currentUser, dto.characterId);

    const worldBook = await this.prisma.worldBook.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(characterId === undefined ? {} : { characterId }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
        ...(dto.scanDepth === undefined ? {} : { scanDepth: dto.scanDepth }),
        ...(dto.tokenBudget === undefined ? {} : { tokenBudget: dto.tokenBudget }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) })
      },
      include: {
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });

    return this.toWorldBookResponse(worldBook);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveWorldBook(currentUser, id);

    await this.prisma.$transaction([
      this.prisma.worldBook.update({
        where: { id },
        data: {
          isEnabled: false,
          deletedAt: new Date()
        }
      }),
      this.prisma.worldBookEntry.updateMany({
        where: {
          worldBookId: id,
          deletedAt: null
        },
        data: {
          isEnabled: false,
          deletedAt: new Date()
        }
      })
    ]);

    return {
      deleted: true,
      id
    };
  }

  async createEntry(
    currentUser: CurrentUser,
    worldBookId: string,
    dto: CreateWorldBookEntryDto
  ): Promise<WorldBookEntryResponse> {
    await this.findOwnedActiveWorldBook(currentUser, worldBookId);

    const entry = await this.prisma.worldBookEntry.create({
      data: {
        worldBookId,
        title: dto.title,
        content: dto.content,
        keywordsJson: JSON.stringify(dto.keywords),
        secondaryKeywordsJson: this.stringifyNullable(dto.secondaryKeywords),
        isEnabled: dto.isEnabled ?? true,
        priority: dto.priority ?? 0,
        position: dto.insertionOrder ?? 'before_history',
        tokenBudget: dto.tokenBudget ?? null,
        caseSensitive: dto.caseSensitive ?? false,
        metadataJson: this.stringifyNullable(dto.metadata)
      }
    });

    return this.toEntryResponse(entry);
  }

  async updateEntry(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateWorldBookEntryDto
  ): Promise<WorldBookEntryResponse> {
    await this.findOwnedActiveEntry(currentUser, id);

    const entry = await this.prisma.worldBookEntry.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(dto.keywords === undefined ? {} : { keywordsJson: JSON.stringify(dto.keywords) }),
        ...(dto.secondaryKeywords === undefined
          ? {}
          : { secondaryKeywordsJson: this.stringifyNullable(dto.secondaryKeywords) }),
        ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
        ...(dto.priority === undefined ? {} : { priority: dto.priority }),
        ...(dto.insertionOrder === undefined ? {} : { position: dto.insertionOrder }),
        ...(dto.tokenBudget === undefined ? {} : { tokenBudget: dto.tokenBudget }),
        ...(dto.caseSensitive === undefined ? {} : { caseSensitive: dto.caseSensitive }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) })
      }
    });

    return this.toEntryResponse(entry);
  }

  async removeEntry(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveEntry(currentUser, id);

    await this.prisma.worldBookEntry.update({
      where: { id },
      data: {
        isEnabled: false,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  private async findOwnedActiveWorldBook(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookWithEntries> {
    const worldBook = await this.prisma.worldBook.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      include: {
        entries: {
          where: {
            deletedAt: null
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!worldBook) {
      throw new NotFoundException({
        code: ERROR_CODES.WORLD_BOOK_NOT_FOUND,
        message: 'World book not found.'
      });
    }

    return worldBook;
  }

  private async findOwnedActiveEntry(
    currentUser: CurrentUser,
    id: string
  ): Promise<WorldBookEntryWithBook> {
    const entry = await this.prisma.worldBookEntry.findFirst({
      where: {
        id,
        deletedAt: null,
        worldBook: {
          userId: currentUser.id,
          deletedAt: null
        }
      },
      include: {
        worldBook: true
      }
    });

    if (!entry) {
      throw new NotFoundException({
        code: ERROR_CODES.WORLD_BOOK_ENTRY_NOT_FOUND,
        message: 'World book entry not found.'
      });
    }

    return entry;
  }

  private async resolveCharacterId(
    currentUser: CurrentUser,
    characterId: string | null | undefined
  ): Promise<string | null> {
    if (!characterId) {
      return null;
    }

    const character: Character | null = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        userId: currentUser.id,
        deletedAt: null
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

  private toWorldBookResponse(worldBook: WorldBookWithEntries): WorldBookResponse {
    return {
      id: worldBook.id,
      userId: worldBook.userId,
      characterId: worldBook.characterId,
      name: worldBook.name,
      description: worldBook.description,
      isEnabled: worldBook.isEnabled,
      scanDepth: worldBook.scanDepth,
      tokenBudget: worldBook.tokenBudget,
      metadata: this.parseRecord(worldBook.metadataJson),
      entries: worldBook.entries.map((entry) => this.toEntryResponse(entry)),
      createdAt: worldBook.createdAt.toISOString(),
      updatedAt: worldBook.updatedAt.toISOString()
    };
  }

  private toEntryResponse(entry: WorldBookEntry): WorldBookEntryResponse {
    return {
      id: entry.id,
      worldBookId: entry.worldBookId,
      title: entry.title,
      content: entry.content,
      keywords: this.parseStringArray(entry.keywordsJson),
      secondaryKeywords: this.parseStringArray(entry.secondaryKeywordsJson),
      isEnabled: entry.isEnabled,
      priority: entry.priority,
      insertionOrder: this.toInsertionOrder(entry.position),
      tokenBudget: entry.tokenBudget,
      caseSensitive: entry.caseSensitive,
      metadata: this.parseRecord(entry.metadataJson),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    };
  }

  private toInsertionOrder(value: string): WorldBookEntryInsertionOrder {
    return WORLD_BOOK_ENTRY_INSERTION_ORDERS.includes(value as WorldBookEntryInsertionOrder)
      ? (value as WorldBookEntryInsertionOrder)
      : 'before_history';
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private parseStringArray(value: string | null): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
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
