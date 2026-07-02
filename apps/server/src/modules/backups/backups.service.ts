import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import {
  APPLICATION_BACKUP_FORMAT_VERSION,
  type ApplicationBackupExport,
  type ApplicationBackupModelConfig,
  type ApplicationBackupSetting,
  type BackupExportFile,
  type BackupImportResponse,
  type BackupImportSummary,
  type BackupJsonRecord
} from './backup.types';
import type { ImportBackupDto } from './dto/import-backup.dto';

const SENSITIVE_SETTING_KEY_PATTERN = /(api[-_]?key|token|secret|password|credential)/i;

type BackupImportPlan = {
  sourceExportedAt: string;
  assets: Prisma.AssetCreateManyInput[];
  characters: Prisma.CharacterCreateManyInput[];
  modelConfigs: Prisma.ModelConfigCreateManyInput[];
  promptPresets: Prisma.PromptPresetCreateManyInput[];
  personas: Prisma.UserPersonaCreateManyInput[];
  conversations: Prisma.ConversationCreateManyInput[];
  messages: Prisma.MessageCreateManyInput[];
  worldBooks: Prisma.WorldBookCreateManyInput[];
  worldBookEntries: Prisma.WorldBookEntryCreateManyInput[];
  appSettings: Prisma.AppSettingCreateManyInput[];
  summary: BackupImportSummary;
  warnings: string[];
};

@Injectable()
export class BackupsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async exportApplicationBackup(currentUser: CurrentUser): Promise<BackupExportFile> {
    const exportedAt = new Date();
    const [
      characters,
      conversations,
      messages,
      worldBooks,
      modelConfigs,
      promptPresets,
      personas,
      appSettings,
      assets
    ] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.conversation.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.message.findMany({
        where: {
          deletedAt: null,
          conversation: {
            userId: currentUser.id,
            deletedAt: null
          }
        },
        orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.worldBook.findMany({
        where: {
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
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.modelConfig.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.promptPreset.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.userPersona.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.appSetting.findMany({
        where: {
          OR: [{ userId: currentUser.id }, { userId: null }]
        },
        orderBy: [{ scope: 'asc' }, { key: 'asc' }]
      }),
      this.prisma.asset.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        orderBy: [{ createdAt: 'desc' }]
      })
    ]);

    const worldBookRecords = this.toBackupRecords(worldBooks);
    const modelConfigRecords = modelConfigs.map((modelConfig) =>
      this.toModelConfigBackupRecord(modelConfig)
    );
    const appSettingRecords = appSettings.map((appSetting) =>
      this.toAppSettingBackupRecord(appSetting)
    );
    const backup: ApplicationBackupExport = {
      formatVersion: APPLICATION_BACKUP_FORMAT_VERSION,
      exportedAt: exportedAt.toISOString(),
      app: {
        name: 'Tavern Lite',
        backupKind: 'logical-json'
      },
      scope: {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName
      },
      strategy: {
        type: 'logical-json',
        description:
          'Exports current active application data as JSON records. It is not a raw SQLite file snapshot.'
      },
      security: {
        apiKeys: {
          mode: 'redacted',
          included: false,
          description:
            'Model API key ciphertext and plaintext are excluded. Only apiKeyMask and hasApiKey are exported.'
        },
        settings: {
          sensitiveKeyPattern: SENSITIVE_SETTING_KEY_PATTERN.source,
          redactedValue: null,
          description:
            'AppSetting values with key names that look like keys, tokens, secrets, passwords or credentials are replaced with null.'
        },
        uploads: {
          binariesIncluded: false,
          description:
            'Uploaded file binaries are not embedded. The export only records asset metadata and relative storage/public paths.'
        },
        excludedTables: ['ModelCallLog']
      },
      summary: {
        characters: characters.length,
        conversations: conversations.length,
        messages: messages.length,
        worldBooks: worldBooks.length,
        worldBookEntries: worldBooks.reduce(
          (total, worldBook) => total + worldBook.entries.length,
          0
        ),
        modelConfigs: modelConfigs.length,
        promptPresets: promptPresets.length,
        personas: personas.length,
        appSettings: appSettings.length,
        assets: assets.length
      },
      data: {
        characters: this.toBackupRecords(characters),
        conversations: this.toBackupRecords(conversations),
        messages: this.toBackupRecords(messages),
        worldBooks: worldBookRecords,
        modelConfigs: modelConfigRecords,
        promptPresets: this.toBackupRecords(promptPresets),
        personas: this.toBackupRecords(personas),
        appSettings: appSettingRecords
      },
      resources: {
        assets: this.toBackupRecords(assets),
        note: 'Asset records are a file checklist for uploads/. Copy the referenced files separately when a full restore needs avatars or imported assets.'
      }
    };

    const body = `${JSON.stringify(backup, null, 2)}\n`;

    return {
      filename: this.createFilename(exportedAt),
      contentType: 'application/json; charset=utf-8',
      body
    };
  }

  async importApplicationBackup(
    currentUser: CurrentUser,
    dto: ImportBackupDto
  ): Promise<BackupImportResponse> {
    if (!dto.confirmOverwrite) {
      throw new BadRequestException({
        code: ERROR_CODES.BACKUP_IMPORT_CONFIRMATION_REQUIRED,
        message: 'Backup import requires explicit overwrite confirmation.'
      });
    }

    const backup = this.parseBackup(dto.rawJson);
    const plan = this.createImportPlan(currentUser, backup);
    const importedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.clearCurrentUserData(tx, currentUser.id);
      await this.restoreImportPlan(tx, plan);
    });

    return {
      imported: true,
      strategy: 'full-overwrite',
      formatVersion: APPLICATION_BACKUP_FORMAT_VERSION,
      importedAt: importedAt.toISOString(),
      sourceExportedAt: plan.sourceExportedAt,
      summary: plan.summary,
      warnings: plan.warnings
    };
  }

  private parseBackup(rawJson: string): ApplicationBackupExport {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.BACKUP_IMPORT_INVALID_JSON,
        message: 'Backup file is not valid JSON.'
      });
    }

    if (!this.isRecord(parsed)) {
      throw this.invalidFormat('Backup root must be an object.');
    }

    if (parsed.formatVersion !== APPLICATION_BACKUP_FORMAT_VERSION) {
      throw new BadRequestException({
        code: ERROR_CODES.BACKUP_IMPORT_INVALID_VERSION,
        message: `Unsupported backup format version: ${String(parsed.formatVersion ?? 'missing')}.`,
        details: {
          expected: APPLICATION_BACKUP_FORMAT_VERSION,
          actual: parsed.formatVersion ?? null
        }
      });
    }

    if (!this.isIsoDateString(parsed.exportedAt)) {
      throw this.invalidFormat('exportedAt must be an ISO date string.');
    }

    if (!this.isRecord(parsed.data)) {
      throw this.invalidFormat('data must be an object.');
    }

    for (const key of [
      'characters',
      'conversations',
      'messages',
      'worldBooks',
      'modelConfigs',
      'promptPresets',
      'personas',
      'appSettings'
    ]) {
      if (!Array.isArray(parsed.data[key])) {
        throw this.invalidFormat(`data.${key} must be an array.`);
      }
    }

    if (!this.isRecord(parsed.resources) || !Array.isArray(parsed.resources.assets)) {
      throw this.invalidFormat('resources.assets must be an array.');
    }

    return parsed as ApplicationBackupExport;
  }

  private createImportPlan(
    currentUser: CurrentUser,
    backup: ApplicationBackupExport
  ): BackupImportPlan {
    const assetRecords = backup.resources.assets;
    const characterRecords = backup.data.characters;
    const modelConfigRecords = backup.data.modelConfigs;
    const promptPresetRecords = backup.data.promptPresets;
    const personaRecords = backup.data.personas;
    const conversationRecords = backup.data.conversations;
    const messageRecords = backup.data.messages;
    const worldBookRecords = backup.data.worldBooks;
    const appSettingRecords = backup.data.appSettings;

    const worldBookEntryRecords = worldBookRecords.flatMap((worldBook, worldBookIndex) =>
      this.getOptionalRecordArray(
        worldBook,
        'entries',
        `data.worldBooks[${worldBookIndex}].entries`
      )
    );

    this.assertUniqueIds(assetRecords, 'resources.assets');
    this.assertUniqueIds(characterRecords, 'data.characters');
    this.assertUniqueIds(modelConfigRecords, 'data.modelConfigs');
    this.assertUniqueIds(promptPresetRecords, 'data.promptPresets');
    this.assertUniqueIds(personaRecords, 'data.personas');
    this.assertUniqueIds(conversationRecords, 'data.conversations');
    this.assertUniqueIds(messageRecords, 'data.messages');
    this.assertUniqueIds(worldBookRecords, 'data.worldBooks');
    this.assertUniqueIds(worldBookEntryRecords, 'data.worldBooks.entries');
    this.assertUniqueBy(
      modelConfigRecords,
      (record) => this.requiredString(record, 'name', 'data.modelConfigs[].name'),
      'data.modelConfigs.name'
    );
    this.assertUniqueBy(
      promptPresetRecords,
      (record) => this.requiredString(record, 'name', 'data.promptPresets[].name'),
      'data.promptPresets.name'
    );
    this.assertUniqueBy(
      personaRecords,
      (record) => this.requiredString(record, 'name', 'data.personas[].name'),
      'data.personas.name'
    );
    this.assertUniqueBy(
      appSettingRecords,
      (record) =>
        `${this.requiredString(record, 'scope', 'data.appSettings[].scope')}::${this.requiredString(record, 'key', 'data.appSettings[].key')}`,
      'data.appSettings.scope/key'
    );

    const assetIds = this.toIdSet(assetRecords);
    const characterIds = this.toIdSet(characterRecords);
    const modelConfigIds = this.toIdSet(modelConfigRecords);
    const promptPresetIds = this.toIdSet(promptPresetRecords);
    const personaIds = this.toIdSet(personaRecords);
    const conversationIds = this.toIdSet(conversationRecords);
    const worldBookIds = this.toIdSet(worldBookRecords);
    const warnings = [
      '当前用户的现有角色、会话、消息、世界书、模型配置、预设、Persona、设置和资源记录会被全量覆盖。',
      '备份 JSON 不包含 uploads 文件二进制，头像等资源需要另行恢复 uploads 目录。',
      '模型 API Key 不会从备份恢复；原来带密钥的模型配置已禁用，需要重新填写密钥后启用。'
    ];

    const assets = assetRecords.map((record, index) =>
      this.toAssetImportInput(currentUser, record, `resources.assets[${index}]`)
    );
    const characters = characterRecords.map((record, index) =>
      this.toCharacterImportInput(
        currentUser,
        record,
        `data.characters[${index}]`,
        assetIds,
        warnings
      )
    );
    const modelConfigs = modelConfigRecords.map((record, index) =>
      this.toModelConfigImportInput(currentUser, record, `data.modelConfigs[${index}]`)
    );
    const promptPresets = promptPresetRecords.map((record, index) =>
      this.toPromptPresetImportInput(currentUser, record, `data.promptPresets[${index}]`)
    );
    const personas = personaRecords.map((record, index) =>
      this.toPersonaImportInput(currentUser, record, `data.personas[${index}]`)
    );
    const conversations = conversationRecords.map((record, index) =>
      this.toConversationImportInput(
        currentUser,
        record,
        `data.conversations[${index}]`,
        {
          characterIds,
          modelConfigIds,
          promptPresetIds,
          personaIds
        },
        warnings
      )
    );
    const messages = messageRecords.map((record, index) =>
      this.toMessageImportInput(record, `data.messages[${index}]`, conversationIds)
    );
    const worldBooks = worldBookRecords.map((record, index) =>
      this.toWorldBookImportInput(
        currentUser,
        record,
        `data.worldBooks[${index}]`,
        characterIds,
        warnings
      )
    );
    const worldBookEntries = worldBookEntryRecords.map((record, index) =>
      this.toWorldBookEntryImportInput(record, `data.worldBooks.entries[${index}]`, worldBookIds)
    );
    const appSettings = appSettingRecords.flatMap((record, index) =>
      this.toAppSettingImportInput(currentUser, record, `data.appSettings[${index}]`)
    );
    const skippedRedactedSettings = appSettingRecords.length - appSettings.length;
    const apiKeysDropped = modelConfigRecords.filter(
      (record) => record.hasApiKey === true || typeof record.apiKeyMask === 'string'
    ).length;
    if (skippedRedactedSettings > 0) {
      warnings.push(`${skippedRedactedSettings} 个脱敏设置项未恢复，需要手动重新配置。`);
    }

    return {
      sourceExportedAt: backup.exportedAt,
      assets,
      characters,
      modelConfigs,
      promptPresets,
      personas,
      conversations,
      messages,
      worldBooks,
      worldBookEntries,
      appSettings,
      summary: {
        characters: characters.length,
        conversations: conversations.length,
        messages: messages.length,
        worldBooks: worldBooks.length,
        worldBookEntries: worldBookEntries.length,
        modelConfigs: modelConfigs.length,
        promptPresets: promptPresets.length,
        personas: personas.length,
        appSettings: appSettings.length,
        assets: assets.length,
        skippedRedactedSettings,
        apiKeysDropped
      },
      warnings
    };
  }

  private async clearCurrentUserData(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.modelCallLog.deleteMany({ where: { userId } });
    await tx.worldBookEntry.deleteMany({
      where: {
        worldBook: {
          userId
        }
      }
    });
    await tx.worldBook.deleteMany({ where: { userId } });
    await tx.message.deleteMany({
      where: {
        conversation: {
          userId
        }
      }
    });
    await tx.conversation.deleteMany({ where: { userId } });
    await tx.character.deleteMany({ where: { userId } });
    await tx.modelConfig.deleteMany({ where: { userId } });
    await tx.promptPreset.deleteMany({ where: { userId } });
    await tx.userPersona.deleteMany({ where: { userId } });
    await tx.asset.deleteMany({ where: { userId } });
    await tx.appSetting.deleteMany({
      where: {
        OR: [{ userId }, { userId: null }]
      }
    });
  }

  private async restoreImportPlan(
    tx: Prisma.TransactionClient,
    plan: BackupImportPlan
  ): Promise<void> {
    if (plan.assets.length > 0) {
      await tx.asset.createMany({ data: plan.assets });
    }

    if (plan.characters.length > 0) {
      await tx.character.createMany({ data: plan.characters });
    }

    if (plan.modelConfigs.length > 0) {
      await tx.modelConfig.createMany({ data: plan.modelConfigs });
    }

    if (plan.promptPresets.length > 0) {
      await tx.promptPreset.createMany({ data: plan.promptPresets });
    }

    if (plan.personas.length > 0) {
      await tx.userPersona.createMany({ data: plan.personas });
    }

    if (plan.conversations.length > 0) {
      await tx.conversation.createMany({ data: plan.conversations });
    }

    if (plan.messages.length > 0) {
      await tx.message.createMany({ data: plan.messages });
    }

    if (plan.worldBooks.length > 0) {
      await tx.worldBook.createMany({ data: plan.worldBooks });
    }

    if (plan.worldBookEntries.length > 0) {
      await tx.worldBookEntry.createMany({ data: plan.worldBookEntries });
    }

    if (plan.appSettings.length > 0) {
      await tx.appSetting.createMany({ data: plan.appSettings });
    }
  }

  private toModelConfigBackupRecord(modelConfig: unknown): ApplicationBackupModelConfig {
    const record = this.toBackupRecord(modelConfig);
    const apiKeyMask = typeof record.apiKeyMask === 'string' ? record.apiKeyMask : null;
    const hasApiKey = Boolean(record.apiKeyCiphertext);

    delete record.apiKeyCiphertext;

    return {
      ...record,
      apiKeyCiphertext: null,
      apiKeyIncluded: false,
      apiKeyMask,
      hasApiKey
    };
  }

  private toAppSettingBackupRecord(appSetting: {
    key: string;
    value: string;
  }): ApplicationBackupSetting {
    const record = this.toBackupRecord(appSetting);
    const redacted = SENSITIVE_SETTING_KEY_PATTERN.test(appSetting.key);

    return {
      ...record,
      value: redacted ? null : appSetting.value,
      redacted,
      redactionReason: redacted ? 'sensitive-setting-key' : null
    };
  }

  private toBackupRecords(values: unknown[]): BackupJsonRecord[] {
    return values.map((value) => this.toBackupRecord(value));
  }

  private toBackupRecord(value: unknown): BackupJsonRecord {
    return JSON.parse(JSON.stringify(value)) as BackupJsonRecord;
  }

  private createFilename(date: Date): string {
    const timestamp = date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');

    return `tavern-lite-backup-${timestamp}.json`;
  }

  private toAssetImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.AssetCreateManyInput {
    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      kind: this.requiredString(record, 'kind', `${path}.kind`),
      fileName: this.requiredString(record, 'fileName', `${path}.fileName`),
      originalName: this.optionalString(record, 'originalName', `${path}.originalName`),
      mimeType: this.requiredString(record, 'mimeType', `${path}.mimeType`),
      extension: this.optionalString(record, 'extension', `${path}.extension`),
      sizeBytes: this.requiredInteger(record, 'sizeBytes', `${path}.sizeBytes`),
      storagePath: this.requiredString(record, 'storagePath', `${path}.storagePath`),
      publicPath: this.optionalString(record, 'publicPath', `${path}.publicPath`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      deletedAt: null
    };
  }

  private toCharacterImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string,
    assetIds: Set<string>,
    warnings: string[]
  ): Prisma.CharacterCreateManyInput {
    const avatarAssetId = this.resolveOptionalReference(
      this.optionalString(record, 'avatarAssetId', `${path}.avatarAssetId`),
      assetIds,
      `${path}.avatarAssetId`,
      warnings
    );

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      avatarAssetId,
      name: this.requiredString(record, 'name', `${path}.name`),
      description: this.requiredString(record, 'description', `${path}.description`),
      personality: this.requiredString(record, 'personality', `${path}.personality`),
      scenario: this.requiredString(record, 'scenario', `${path}.scenario`),
      firstMessage: this.requiredString(record, 'firstMessage', `${path}.firstMessage`),
      exampleMessagesJson: this.optionalString(
        record,
        'exampleMessagesJson',
        `${path}.exampleMessagesJson`
      ),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isArchived: this.requiredBoolean(record, 'isArchived', `${path}.isArchived`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toModelConfigImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.ModelConfigCreateManyInput {
    const hadApiKey = record.hasApiKey === true || typeof record.apiKeyMask === 'string';

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      name: this.requiredString(record, 'name', `${path}.name`),
      provider: this.requiredString(record, 'provider', `${path}.provider`),
      baseUrl: this.requiredString(record, 'baseUrl', `${path}.baseUrl`),
      model: this.requiredString(record, 'model', `${path}.model`),
      apiKeyCiphertext: null,
      apiKeyMask: null,
      defaultParamsJson: this.optionalString(
        record,
        'defaultParamsJson',
        `${path}.defaultParamsJson`
      ),
      isDefault: this.requiredBoolean(record, 'isDefault', `${path}.isDefault`),
      isEnabled: hadApiKey ? false : this.requiredBoolean(record, 'isEnabled', `${path}.isEnabled`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toPromptPresetImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.PromptPresetCreateManyInput {
    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      name: this.requiredString(record, 'name', `${path}.name`),
      description: this.requiredString(record, 'description', `${path}.description`),
      systemPrompt: this.requiredString(record, 'systemPrompt', `${path}.systemPrompt`),
      outputRules: this.requiredString(record, 'outputRules', `${path}.outputRules`),
      parametersJson: this.optionalString(record, 'parametersJson', `${path}.parametersJson`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isDefault: this.requiredBoolean(record, 'isDefault', `${path}.isDefault`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toPersonaImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.UserPersonaCreateManyInput {
    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      name: this.requiredString(record, 'name', `${path}.name`),
      content: this.requiredString(record, 'content', `${path}.content`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isDefault: this.requiredBoolean(record, 'isDefault', `${path}.isDefault`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toConversationImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string,
    refs: {
      characterIds: Set<string>;
      modelConfigIds: Set<string>;
      promptPresetIds: Set<string>;
      personaIds: Set<string>;
    },
    warnings: string[]
  ): Prisma.ConversationCreateManyInput {
    const characterId = this.requiredString(record, 'characterId', `${path}.characterId`);
    const modelConfigId = this.resolveOptionalReference(
      this.optionalString(record, 'modelConfigId', `${path}.modelConfigId`),
      refs.modelConfigIds,
      `${path}.modelConfigId`,
      warnings
    );
    const promptPresetId = this.resolveOptionalReference(
      this.optionalString(record, 'promptPresetId', `${path}.promptPresetId`),
      refs.promptPresetIds,
      `${path}.promptPresetId`,
      warnings
    );
    const personaId = this.resolveOptionalReference(
      this.optionalString(record, 'personaId', `${path}.personaId`),
      refs.personaIds,
      `${path}.personaId`,
      warnings
    );

    if (!refs.characterIds.has(characterId)) {
      throw this.invalidFormat(`${path}.characterId references a missing character.`);
    }

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      characterId,
      modelConfigId,
      promptPresetId,
      personaId,
      title: this.requiredString(record, 'title', `${path}.title`),
      status: this.requiredString(record, 'status', `${path}.status`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      lastMessageAt: this.optionalDate(record, 'lastMessageAt', `${path}.lastMessageAt`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toMessageImportInput(
    record: BackupJsonRecord,
    path: string,
    conversationIds: Set<string>
  ): Prisma.MessageCreateManyInput {
    const conversationId = this.requiredString(record, 'conversationId', `${path}.conversationId`);

    if (!conversationIds.has(conversationId)) {
      throw this.invalidFormat(`${path}.conversationId references a missing conversation.`);
    }

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      conversationId,
      role: this.requiredString(record, 'role', `${path}.role`),
      content: this.requiredString(record, 'content', `${path}.content`),
      status: this.requiredString(record, 'status', `${path}.status`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      tokenCount: this.optionalInteger(record, 'tokenCount', `${path}.tokenCount`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toWorldBookImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string,
    characterIds: Set<string>,
    warnings: string[]
  ): Prisma.WorldBookCreateManyInput {
    const characterId = this.resolveOptionalReference(
      this.optionalString(record, 'characterId', `${path}.characterId`),
      characterIds,
      `${path}.characterId`,
      warnings
    );

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      characterId,
      name: this.requiredString(record, 'name', `${path}.name`),
      description: this.requiredString(record, 'description', `${path}.description`),
      isEnabled: this.requiredBoolean(record, 'isEnabled', `${path}.isEnabled`),
      scanDepth: this.requiredInteger(record, 'scanDepth', `${path}.scanDepth`),
      tokenBudget: this.requiredInteger(record, 'tokenBudget', `${path}.tokenBudget`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toWorldBookEntryImportInput(
    record: BackupJsonRecord,
    path: string,
    worldBookIds: Set<string>
  ): Prisma.WorldBookEntryCreateManyInput {
    const worldBookId = this.requiredString(record, 'worldBookId', `${path}.worldBookId`);

    if (!worldBookIds.has(worldBookId)) {
      throw this.invalidFormat(`${path}.worldBookId references a missing world book.`);
    }

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      worldBookId,
      title: this.requiredString(record, 'title', `${path}.title`),
      content: this.requiredString(record, 'content', `${path}.content`),
      keywordsJson: this.requiredString(record, 'keywordsJson', `${path}.keywordsJson`),
      secondaryKeywordsJson: this.optionalString(
        record,
        'secondaryKeywordsJson',
        `${path}.secondaryKeywordsJson`
      ),
      isEnabled: this.requiredBoolean(record, 'isEnabled', `${path}.isEnabled`),
      priority: this.requiredInteger(record, 'priority', `${path}.priority`),
      position: this.requiredString(record, 'position', `${path}.position`),
      tokenBudget: this.optionalInteger(record, 'tokenBudget', `${path}.tokenBudget`),
      caseSensitive: this.requiredBoolean(record, 'caseSensitive', `${path}.caseSensitive`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toAppSettingImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.AppSettingCreateManyInput[] {
    const key = this.requiredString(record, 'key', `${path}.key`);
    const redacted = record.redacted === true || SENSITIVE_SETTING_KEY_PATTERN.test(key);

    if (redacted) {
      return [];
    }

    return [
      {
        id: this.requiredString(record, 'id', `${path}.id`),
        userId: record.userId === null ? null : currentUser.id,
        scope: this.requiredString(record, 'scope', `${path}.scope`),
        key,
        value: this.requiredString(record, 'value', `${path}.value`),
        valueType: this.requiredString(record, 'valueType', `${path}.valueType`),
        createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
        updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`)
      }
    ];
  }

  private getOptionalRecordArray(
    record: BackupJsonRecord,
    field: string,
    path: string
  ): BackupJsonRecord[] {
    const value = record[field];

    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value) || !value.every((item) => this.isRecord(item))) {
      throw this.invalidFormat(`${path} must be an array of objects when present.`);
    }

    return value as BackupJsonRecord[];
  }

  private toIdSet(records: BackupJsonRecord[]): Set<string> {
    return new Set(records.map((record) => this.requiredString(record, 'id', 'id')));
  }

  private assertUniqueIds(records: BackupJsonRecord[], path: string): void {
    this.assertUniqueBy(
      records,
      (record) => this.requiredString(record, 'id', `${path}[].id`),
      path
    );
  }

  private assertUniqueBy(
    records: BackupJsonRecord[],
    getValue: (record: BackupJsonRecord) => string,
    path: string
  ): void {
    const seen = new Set<string>();

    for (const record of records) {
      const value = getValue(record);

      if (seen.has(value)) {
        throw this.invalidFormat(`${path} contains duplicate value: ${value}.`);
      }

      seen.add(value);
    }
  }

  private resolveOptionalReference(
    value: string | null,
    availableIds: Set<string>,
    path: string,
    warnings: string[]
  ): string | null {
    if (!value || availableIds.has(value)) {
      return value;
    }

    warnings.push(`${path} references missing id ${value}; restored as null.`);

    return null;
  }

  private requiredString(record: BackupJsonRecord, field: string, path: string): string {
    const value = record[field];

    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string.`);
    }

    return value;
  }

  private optionalString(record: BackupJsonRecord, field: string, path: string): string | null {
    const value = record[field];

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string or null.`);
    }

    return value;
  }

  private requiredBoolean(record: BackupJsonRecord, field: string, path: string): boolean {
    const value = record[field];

    if (typeof value !== 'boolean') {
      throw this.invalidFormat(`${path} must be a boolean.`);
    }

    return value;
  }

  private requiredInteger(record: BackupJsonRecord, field: string, path: string): number {
    const value = record[field];

    if (!Number.isInteger(value)) {
      throw this.invalidFormat(`${path} must be an integer.`);
    }

    return value as number;
  }

  private optionalInteger(record: BackupJsonRecord, field: string, path: string): number | null {
    const value = record[field];

    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isInteger(value)) {
      throw this.invalidFormat(`${path} must be an integer or null.`);
    }

    return value as number;
  }

  private requiredDate(record: BackupJsonRecord, field: string, path: string): Date {
    const value = record[field];

    if (!this.isIsoDateString(value)) {
      throw this.invalidFormat(`${path} must be an ISO date string.`);
    }

    return new Date(value);
  }

  private optionalDate(record: BackupJsonRecord, field: string, path: string): Date | null {
    const value = record[field];

    if (value === null || value === undefined) {
      return null;
    }

    if (!this.isIsoDateString(value)) {
      throw this.invalidFormat(`${path} must be an ISO date string or null.`);
    }

    return new Date(value);
  }

  private isIsoDateString(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }

  private isRecord(value: unknown): value is BackupJsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalidFormat(message: string): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODES.BACKUP_IMPORT_INVALID_FORMAT,
      message,
      details: {
        expectedFormatVersion: APPLICATION_BACKUP_FORMAT_VERSION
      }
    });
  }
}
