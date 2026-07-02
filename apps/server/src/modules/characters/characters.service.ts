import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Asset, Character } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { CHARACTER_AVATAR_KIND } from '../assets/assets.constants';
import type { CurrentUser } from '../users/user.types';
import type {
  CharacterExportResponse,
  CharacterImportPreview,
  CharacterImportResponse,
  CharacterListResponse,
  CharacterResponse,
  ExampleMessage
} from './character.types';
import type { CreateCharacterDto } from './dto/create-character.dto';
import type { ImportCharacterDto } from './dto/import-character.dto';
import type { QueryCharactersDto } from './dto/query-characters.dto';
import type { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterCardJsonExporter } from './export/character-card-json-exporter';
import { CharacterCardJsonImporter } from './import/character-card-json-importer';

type CharacterWithAvatar = Character & {
  avatarAsset: Asset | null;
};

@Injectable()
export class CharactersService {
  private readonly exporter = new CharacterCardJsonExporter();
  private readonly importer = new CharacterCardJsonImporter();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async list(currentUser: CurrentUser, query: QueryCharactersDto): Promise<CharacterListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(query.isArchived === undefined ? {} : { isArchived: query.isArchived }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
              { personality: { contains: query.search } },
              { scenario: { contains: query.search } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where,
        include: {
          avatarAsset: true
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.character.count({ where })
    ]);

    return {
      items: items.map((character) => this.toResponse(character)),
      total,
      page,
      pageSize
    };
  }

  async create(currentUser: CurrentUser, dto: CreateCharacterDto): Promise<CharacterResponse> {
    const avatarAssetId = await this.resolveAvatarAssetId(currentUser, dto.avatarAssetId);
    const character = await this.prisma.character.create({
      data: {
        userId: currentUser.id,
        avatarAssetId,
        name: dto.name,
        description: dto.description ?? '',
        personality: dto.personality ?? '',
        scenario: dto.scenario ?? '',
        firstMessage: dto.firstMessage ?? '',
        exampleMessagesJson: this.stringifyNullable(dto.exampleMessages),
        metadataJson: this.stringifyNullable(dto.metadata),
        isArchived: dto.isArchived ?? false
      },
      include: {
        avatarAsset: true
      }
    });

    return this.toResponse(character);
  }

  async importJson(
    currentUser: CurrentUser,
    dto: ImportCharacterDto
  ): Promise<CharacterImportResponse> {
    const mapped = this.importer.map(dto.rawJson);
    const preview = await this.toImportPreview(currentUser, mapped);

    if (!dto.commit) {
      return {
        imported: false,
        preview,
        character: null
      };
    }

    const importName =
      preview.nameConflict && dto.duplicateNameStrategy === 'rename'
        ? preview.suggestedName
        : preview.name;

    if (!importName) {
      throw new ConflictException({
        code: ERROR_CODES.CHARACTER_IMPORT_NAME_EXISTS,
        message: 'Character name already exists.',
        details: {
          name: preview.name,
          suggestedName: preview.suggestedName
        }
      });
    }

    if (preview.nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: ERROR_CODES.CHARACTER_IMPORT_NAME_EXISTS,
        message: 'Character name already exists. Choose a rename strategy to import a copy.',
        details: {
          name: preview.name,
          suggestedName: preview.suggestedName
        }
      });
    }

    const character = await this.prisma.character.create({
      data: {
        userId: currentUser.id,
        avatarAssetId: null,
        name: importName,
        description: preview.description,
        personality: preview.personality,
        scenario: preview.scenario,
        firstMessage: preview.firstMessage,
        exampleMessagesJson: this.stringifyNullable(preview.exampleMessages),
        metadataJson: this.stringifyNullable(preview.metadata),
        isArchived: false
      },
      include: {
        avatarAsset: true
      }
    });

    return {
      imported: true,
      preview: {
        ...preview,
        name: importName,
        nameConflict: false,
        suggestedName: null
      },
      character: this.toResponse(character)
    };
  }

  async getById(currentUser: CurrentUser, id: string): Promise<CharacterResponse> {
    return this.toResponse(await this.findOwnedActiveCharacter(currentUser, id));
  }

  async exportJson(currentUser: CurrentUser, id: string): Promise<CharacterExportResponse> {
    const character = await this.findOwnedActiveCharacter(currentUser, id);

    return this.exporter.export(
      character,
      this.parseRecord(character.metadataJson),
      this.parseExampleMessages(character.exampleMessagesJson)
    );
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateCharacterDto
  ): Promise<CharacterResponse> {
    await this.findOwnedActiveCharacter(currentUser, id);
    const avatarAssetId =
      dto.avatarAssetId === undefined
        ? undefined
        : await this.resolveAvatarAssetId(currentUser, dto.avatarAssetId);

    const character = await this.prisma.character.update({
      where: { id },
      data: {
        ...(avatarAssetId === undefined ? {} : { avatarAssetId }),
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.personality === undefined ? {} : { personality: dto.personality }),
        ...(dto.scenario === undefined ? {} : { scenario: dto.scenario }),
        ...(dto.firstMessage === undefined ? {} : { firstMessage: dto.firstMessage }),
        ...(dto.exampleMessages === undefined
          ? {}
          : { exampleMessagesJson: this.stringifyNullable(dto.exampleMessages) }),
        ...(dto.metadata === undefined
          ? {}
          : { metadataJson: this.stringifyNullable(dto.metadata) }),
        ...(dto.isArchived === undefined ? {} : { isArchived: dto.isArchived })
      },
      include: {
        avatarAsset: true
      }
    });

    return this.toResponse(character);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveCharacter(currentUser, id);

    await this.prisma.character.update({
      where: { id },
      data: {
        isArchived: true,
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  private async findOwnedActiveCharacter(
    currentUser: CurrentUser,
    id: string
  ): Promise<CharacterWithAvatar> {
    const character = await this.prisma.character.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null
      },
      include: {
        avatarAsset: true
      }
    });

    if (!character) {
      throw new NotFoundException({
        code: ERROR_CODES.CHARACTER_NOT_FOUND,
        message: 'Character not found.'
      });
    }

    return character;
  }

  private async resolveAvatarAssetId(
    currentUser: CurrentUser,
    avatarAssetId: string | null | undefined
  ): Promise<string | null> {
    if (!avatarAssetId) {
      return null;
    }

    const asset = await this.prisma.asset.findFirst({
      where: {
        id: avatarAssetId,
        userId: currentUser.id,
        kind: CHARACTER_AVATAR_KIND,
        deletedAt: null
      }
    });

    if (!asset) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_NOT_FOUND,
        message: 'Avatar asset not found.'
      });
    }

    return asset.id;
  }

  private async toImportPreview(
    currentUser: CurrentUser,
    mapped: Omit<CharacterImportPreview, 'nameConflict' | 'suggestedName'>
  ): Promise<CharacterImportPreview> {
    const existing = await this.prisma.character.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        name: mapped.name
      },
      select: {
        id: true
      }
    });
    const nameConflict = Boolean(existing);
    const suggestedName = nameConflict
      ? await this.createSuggestedImportName(currentUser, mapped.name)
      : null;

    return {
      ...mapped,
      warnings: nameConflict
        ? [
            ...mapped.warnings,
            {
              code: 'NAME_CONFLICT',
              field: 'name',
              message: `已存在同名角色「${mapped.name}」，默认不会覆盖。`
            }
          ]
        : mapped.warnings,
      nameConflict,
      suggestedName
    };
  }

  private async createSuggestedImportName(currentUser: CurrentUser, name: string): Promise<string> {
    const baseName = `${name} 导入副本`.slice(0, 110);
    let candidate = baseName;
    let index = 2;

    while (await this.characterNameExists(currentUser, candidate)) {
      candidate = `${baseName} ${index}`.slice(0, 120);
      index += 1;
    }

    return candidate;
  }

  private async characterNameExists(currentUser: CurrentUser, name: string): Promise<boolean> {
    const character = await this.prisma.character.findFirst({
      where: {
        userId: currentUser.id,
        deletedAt: null,
        name
      },
      select: {
        id: true
      }
    });

    return Boolean(character);
  }

  private toResponse(character: CharacterWithAvatar): CharacterResponse {
    return {
      id: character.id,
      userId: character.userId,
      avatarAssetId: character.avatarAssetId,
      avatarUrl: character.avatarAsset?.publicPath ?? null,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
      exampleMessages: this.parseExampleMessages(character.exampleMessagesJson),
      metadata: this.parseRecord(character.metadataJson),
      isArchived: character.isArchived,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString()
    };
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private parseExampleMessages(value: string | null): ExampleMessage[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return Array.isArray(parsed) ? (parsed as ExampleMessage[]) : [];
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
