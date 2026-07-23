import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import {
  APPLICATION_BACKUP_FORMAT_VERSION,
  type ApplicationBackupExport,
  type ApplicationBackupSetting,
  type BackupExportFile,
  type BackupImportResponse,
  type BackupImportSummary,
  type BackupJsonRecord
} from './backup.types';
import type { ImportBackupDto } from './dto/import-backup.dto';

/** 敏感设置 key 名匹配模式（含 api_key/token/secret/password/credential 的值会被脱敏）。 */
const SENSITIVE_SETTING_KEY_PATTERN = /(api[-_]?key|token|secret|password|credential)/i;

/** 导入计划：各表的 Prisma 批量创建输入 + 统计 + 警告。 */
type BackupImportPlan = {
  sourceExportedAt: string;
  assets: Prisma.AssetCreateManyInput[];
  characters: Prisma.CharacterCreateManyInput[];
  promptPresets: Prisma.PromptPresetCreateManyInput[];
  personas: Prisma.UserPersonaCreateManyInput[];
  conversations: Prisma.ConversationCreateManyInput[];
  messages: Prisma.MessageCreateManyInput[];
  worldBooks: Prisma.WorldBookCreateManyInput[];
  worldBookCharacters: Prisma.WorldBookCharacterCreateManyInput[];
  worldBookEntries: Prisma.WorldBookEntryCreateManyInput[];
  worldBookEntryRevisions: Prisma.WorldBookEntryRevisionCreateManyInput[];
  appSettings: Prisma.AppSettingCreateManyInput[];
  summary: BackupImportSummary;
  warnings: string[];
};

/**
 * 备份服务：应用数据的导出与导入（逻辑 JSON 格式）。
 *
 * 设计要点：
 * - 导出：多表查询当前用户的活跃数据，apiKey 密文不导出、敏感设置值脱敏、上传文件二进制不嵌入；
 * - 导入：全量覆盖（先清空当前用户数据再恢复），需显式确认；
 * - 导入前严格校验格式、版本、各表数据的唯一性和关联完整性。
 */
@Injectable()
export class BackupsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * 导出应用备份：查询各表活跃数据 → 组装备份结构（含脱敏）→ 序列化 JSON。
   * @param currentUser 当前登录用户。
   * @returns 含文件名、content-type、JSON 文本的备份文件。
   */
  async exportApplicationBackup(currentUser: CurrentUser): Promise<BackupExportFile> {
    const exportedAt = new Date();
    // 事务内并行查询各表当前用户的活跃数据（按 updatedAt 倒序）
    const [
      characters,
      conversations,
      messages,
      worldBooks,
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
      // 消息通过 conversation 关联校验用户归属
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
      // 世界书含其条目（嵌套查询）
      this.prisma.worldBook.findMany({
        where: {
          userId: currentUser.id,
          deletedAt: null
        },
        include: {
          characterLinks: {
            select: { characterId: true },
            orderBy: { createdAt: 'asc' }
          },
          entries: {
            where: {
              deletedAt: null
            },
            orderBy: { createdAt: 'asc' },
            include: { activeRevision: true }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
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
      // 应用设置含用户级和全局级（userId 为 null）
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

    // 特殊处理：世界书（含条目）、应用设置（脱敏敏感值）
    const worldBookRecords = worldBooks.map(({ characterLinks, ...worldBook }) =>
      this.toBackupRecord({
        ...worldBook,
        characterIds: characterLinks.map((link) => link.characterId)
      })
    );
    const appSettingRecords = appSettings.map((appSetting) =>
      this.toAppSettingBackupRecord(appSetting)
    );
    // 组装备份结构
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
        // 敏感设置值：key 名像密钥/令牌/密码的，值置 null
        settings: {
          sensitiveKeyPattern: SENSITIVE_SETTING_KEY_PATTERN.source,
          redactedValue: null,
          description:
            'AppSetting values with key names that look like keys, tokens, secrets, passwords or credentials are replaced with null.'
        },
        // 上传文件：不嵌入二进制，只记录元数据
        uploads: {
          binariesIncluded: false,
          description:
            'Uploaded file binaries are not embedded. The export only records asset metadata and relative storage/public paths.'
        },
        excludedTables: []
      },
      summary: {
        characters: characters.length,
        conversations: conversations.length,
        messages: messages.length,
        worldBooks: worldBooks.length,
        // 世界书条目总数 = 各世界书条目数之和
        worldBookEntries: worldBooks.reduce(
          (total, worldBook) => total + worldBook.entries.length,
          0
        ),
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

  /**
   * 导入应用备份：校验确认 → 解析 → 建导入计划 → 事务内清空+恢复。
   *
   * 策略：full-overwrite（全量覆盖当前用户数据）。
   *
   * @param currentUser 当前登录用户。
   * @param dto 导入入参。
   * @returns 导入响应（含统计和警告）。
   * @throws BadRequestException 未确认覆盖 / JSON 非法 / 版本不符 / 格式错误。
   */
  async importApplicationBackup(
    currentUser: CurrentUser,
    dto: ImportBackupDto
  ): Promise<BackupImportResponse> {
    // 必须显式确认覆盖
    if (!dto.confirmOverwrite) {
      throw new BadRequestException({
        code: ERROR_CODES.BACKUP_IMPORT_CONFIRMATION_REQUIRED,
        message: 'Backup import requires explicit overwrite confirmation.'
      });
    }

    // 解析并校验备份格式
    const backup = this.parseBackup(dto.rawJson);
    // 建导入计划（校验唯一性/关联 + 转成 Prisma 输入）
    const plan = this.createImportPlan(currentUser, backup);
    const importedAt = new Date();

    // 事务内：先清空当前用户数据，再按计划恢复
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

  /**
   * 解析备份 JSON 并校验格式：根对象、版本、时间、各数据数组。
   * @param rawJson 备份 JSON 文本。
   * @returns 解析后的备份结构。
   * @throws BadRequestException JSON 非法 / 版本不符 / 格式错误。
   */
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

    // 根必须是对象
    if (!this.isRecord(parsed)) {
      throw this.invalidFormat('Backup root must be an object.');
    }

    // 版本必须匹配
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

    // exportedAt 必须是合法 ISO 日期
    if (!this.isIsoDateString(parsed.exportedAt)) {
      throw this.invalidFormat('exportedAt must be an ISO date string.');
    }

    // data 必须是对象
    if (!this.isRecord(parsed.data)) {
      throw this.invalidFormat('data must be an object.');
    }

    // data 下各字段必须是数组
    for (const key of [
      'characters',
      'conversations',
      'messages',
      'worldBooks',
      'promptPresets',
      'personas',
      'appSettings'
    ]) {
      if (!Array.isArray(parsed.data[key])) {
        throw this.invalidFormat(`data.${key} must be an array.`);
      }
    }

    // resources.assets 必须是数组
    if (!this.isRecord(parsed.resources) || !Array.isArray(parsed.resources.assets)) {
      throw this.invalidFormat('resources.assets must be an array.');
    }

    return parsed as ApplicationBackupExport;
  }

  /**
   * 创建导入计划：校验各表唯一性/关联 → 转成 Prisma 批量创建输入 → 统计 + 警告。
   *
   * 校验内容：
   * - 各表 id 唯一；
   * - 模型配置/预设/人设的 name 唯一；
   * - 应用设置的 scope+key 唯一；
   * - 会话的 characterId、消息的 conversationId、世界书条目的 worldBookId 等关联必须存在。
   *
   * @param currentUser 当前登录用户。
   * @param backup 备份结构。
   * @returns 导入计划（各表输入 + 统计 + 警告）。
   * @throws BadRequestException 关联缺失或唯一性冲突。
   */
  private createImportPlan(
    currentUser: CurrentUser,
    backup: ApplicationBackupExport
  ): BackupImportPlan {
    const assetRecords = backup.resources.assets;
    const characterRecords = backup.data.characters;
    const promptPresetRecords = backup.data.promptPresets;
    const personaRecords = backup.data.personas;
    const conversationRecords = backup.data.conversations;
    const messageRecords = backup.data.messages;
    const worldBookRecords = backup.data.worldBooks;
    const appSettingRecords = backup.data.appSettings;

    // 世界书条目：从各世界书的 entries 字段拍平
    const worldBookEntryRecords = worldBookRecords.flatMap((worldBook, worldBookIndex) =>
      this.getOptionalRecordArray(
        worldBook,
        'entries',
        `data.worldBooks[${worldBookIndex}].entries`
      )
    );

    // 校验各表 id 唯一
    this.assertUniqueIds(assetRecords, 'resources.assets');
    this.assertUniqueIds(characterRecords, 'data.characters');
    this.assertUniqueIds(promptPresetRecords, 'data.promptPresets');
    this.assertUniqueIds(personaRecords, 'data.personas');
    this.assertUniqueIds(conversationRecords, 'data.conversations');
    this.assertUniqueIds(messageRecords, 'data.messages');
    this.assertUniqueIds(worldBookRecords, 'data.worldBooks');
    this.assertUniqueIds(worldBookEntryRecords, 'data.worldBooks.entries');
    // 校验 name 唯一（预设/人设）
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
    // 校验应用设置 scope+key 唯一
    this.assertUniqueBy(
      appSettingRecords,
      (record) =>
        `${this.requiredString(record, 'scope', 'data.appSettings[].scope')}::${this.requiredString(record, 'key', 'data.appSettings[].key')}`,
      'data.appSettings.scope/key'
    );

    // 收集各表 id 集合，供关联校验
    const assetIds = this.toIdSet(assetRecords);
    const characterIds = this.toIdSet(characterRecords);
    const promptPresetIds = this.toIdSet(promptPresetRecords);
    const personaIds = this.toIdSet(personaRecords);
    const conversationIds = this.toIdSet(conversationRecords);
    const worldBookIds = this.toIdSet(worldBookRecords);
    // 固定警告（告知用户覆盖范围和限制）
    const warnings = [
      '当前用户的现有角色、会话、消息、世界书、预设、Persona、设置和资源记录会被全量覆盖。',
      '备份 JSON 不包含 uploads 文件二进制，头像等资源需要另行恢复 uploads 目录。',
      '备份不含模型配置（供应商/模型/模型链），恢复后需要重新配置模型链。'
    ];

    // 各表记录 → Prisma 批量创建输入（校验字段类型 + 关联）
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
      this.toWorldBookImportInput(currentUser, record, `data.worldBooks[${index}]`)
    );
    const worldBookCharacters = worldBookRecords.flatMap((record, index) =>
      this.toWorldBookCharacterImportInputs(
        record,
        `data.worldBooks[${index}]`,
        characterIds,
        warnings
      )
    );
    const worldBookEntries = worldBookEntryRecords.map((record, index) =>
      this.toWorldBookEntryImportInput(record, `data.worldBooks.entries[${index}]`, worldBookIds)
    );
    // 敏感设置跳过（flatMap 返回空数组）
    const appSettings = appSettingRecords.flatMap((record, index) =>
      this.toAppSettingImportInput(currentUser, record, `data.appSettings[${index}]`)
    );
    const skippedRedactedSettings = appSettingRecords.length - appSettings.length;
    if (skippedRedactedSettings > 0) {
      warnings.push(`${skippedRedactedSettings} 个脱敏设置项未恢复，需要手动重新配置。`);
    }

    return {
      sourceExportedAt: backup.exportedAt,
      assets,
      characters,
      promptPresets,
      personas,
      conversations,
      messages,
      worldBooks,
      worldBookCharacters,
      worldBookEntries,
      worldBookEntryRevisions: worldBookEntryRecords.map((record, index) =>
        this.toWorldBookEntryRevisionImportInput(
          record,
          `data.worldBooks.entries[${index}].activeRevision`
        )
      ),
      appSettings,
      summary: {
        characters: characters.length,
        conversations: conversations.length,
        messages: messages.length,
        worldBooks: worldBooks.length,
        worldBookEntries: worldBookEntries.length,
        promptPresets: promptPresets.length,
        personas: personas.length,
        appSettings: appSettings.length,
        assets: assets.length,
        skippedRedactedSettings
      },
      warnings
    };
  }

  /**
   * 清空当前用户的全部数据（按依赖顺序删，避免外键冲突）。
   *
   * 顺序：世界书条目 → 世界书 → 消息 → 会话 → 角色 →
   * 预设 → 人设 → 素材 → 应用设置。
   * @param tx Prisma 事务客户端。
   * @param userId 用户 ID。
   */
  private async clearCurrentUserData(tx: Prisma.TransactionClient, userId: string): Promise<void> {
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
    await tx.promptPreset.deleteMany({ where: { userId } });
    await tx.userPersona.deleteMany({ where: { userId } });
    await tx.asset.deleteMany({ where: { userId } });
    // 应用设置含全局级（userId 为 null）
    await tx.appSetting.deleteMany({
      where: {
        OR: [{ userId }, { userId: null }]
      }
    });
  }

  /**
   * 按导入计划恢复数据（按依赖顺序建，先无依赖的后有依赖的）。
   *
   * 顺序：素材 → 角色 → 预设 → 人设 → 会话 → 消息 → 世界书 → 世界书条目 → 设置。
   * @param tx Prisma 事务客户端。
   * @param plan 导入计划。
   */
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

    if (plan.worldBookCharacters.length > 0) {
      await tx.worldBookCharacter.createMany({ data: plan.worldBookCharacters });
    }

    if (plan.worldBookEntries.length > 0) {
      await tx.worldBookEntry.createMany({ data: plan.worldBookEntries });
    }

    if (plan.worldBookEntryRevisions.length > 0) {
      await tx.worldBookEntryRevision.createMany({ data: plan.worldBookEntryRevisions });
      for (const revision of plan.worldBookEntryRevisions) {
        await tx.worldBookEntry.update({
          where: { id: revision.entryId },
          data: { activeRevisionId: revision.id }
        });
      }
    }

    if (plan.appSettings.length > 0) {
      await tx.appSetting.createMany({ data: plan.appSettings });
    }
  }

  /**
   * 应用设置 → 备份记录：key 名敏感的，值脱敏为 null。
   * @param appSetting 应用设置记录。
   * @returns 应用设置备份记录。
   */
  private toAppSettingBackupRecord(appSetting: {
    key: string;
    value: string;
  }): ApplicationBackupSetting {
    const record = this.toBackupRecord(appSetting);
    // key 名匹配敏感模式 → 值置 null
    const redacted = SENSITIVE_SETTING_KEY_PATTERN.test(appSetting.key);

    return {
      ...record,
      value: redacted ? null : appSetting.value,
      redacted,
      redactionReason: redacted ? 'sensitive-setting-key' : null
    };
  }

  /**
   * 数组 → 备份记录数组（深拷贝，断开 Prisma 对象引用）。
   * @param values 原始数组。
   * @returns 备份记录数组。
   */
  private toBackupRecords(values: unknown[]): BackupJsonRecord[] {
    return values.map((value) => this.toBackupRecord(value));
  }

  /**
   * 值 → 备份记录（JSON 序列化+反序列化做深拷贝，转成普通对象）。
   * @param value 原始值。
   * @returns 备份记录。
   */
  private toBackupRecord(value: unknown): BackupJsonRecord {
    return JSON.parse(JSON.stringify(value)) as BackupJsonRecord;
  }

  /** 生成备份文件名：tavern-lite-backup-{时间戳}.json（去掉分隔符）。 */
  private createFilename(date: Date): string {
    const timestamp = date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');

    return `tavern-lite-backup-${timestamp}.json`;
  }

  /**
   * 素材备份记录 → Prisma 创建输入（校验各字段类型）。
   * @param currentUser 当前登录用户。
   * @param record 素材备份记录。
   * @param path 字段路径（用于错误提示）。
   * @returns Prisma 素材创建输入。
   */
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

  /**
   * 角色备份记录 → Prisma 创建输入（avatarAssetId 关联校验，缺失则置 null 并告警）。
   * @param currentUser 当前登录用户。
   * @param record 角色备份记录。
   * @param path 字段路径。
   * @param assetIds 素材 id 集合。
   * @param warnings 警告收集数组。
   * @returns Prisma 角色创建输入。
   */
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
      coreIdentity: this.requiredString(record, 'coreIdentity', `${path}.coreIdentity`),
      personality: this.requiredString(record, 'personality', `${path}.personality`),
      persistentPremise: this.requiredString(
        record,
        'persistentPremise',
        `${path}.persistentPremise`
      ),
      initialScenario: this.requiredString(record, 'initialScenario', `${path}.initialScenario`),
      extendedBackground: this.requiredString(
        record,
        'extendedBackground',
        `${path}.extendedBackground`
      ),
      characterRules: this.requiredString(record, 'characterRules', `${path}.characterRules`),
      speechStyle: this.requiredString(record, 'speechStyle', `${path}.speechStyle`),
      firstMessage: this.requiredString(record, 'firstMessage', `${path}.firstMessage`),
      exampleMessagesJson: this.optionalString(
        record,
        'exampleMessagesJson',
        `${path}.exampleMessagesJson`
      ),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isSensitive: this.optionalBoolean(record, 'isSensitive', false, `${path}.isSensitive`),
      isShared: this.optionalBoolean(record, 'isShared', false, `${path}.isShared`),
      isArchived: this.requiredBoolean(record, 'isArchived', `${path}.isArchived`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  /**
   * 预设备份记录 → Prisma 创建输入。
   * @param currentUser 当前登录用户。
   * @param record 预设备份记录。
   * @param path 字段路径。
   * @returns Prisma 预设创建输入。
   */
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
      instructionsJson: this.requiredString(record, 'instructionsJson', `${path}.instructionsJson`),
      outputRulesJson: this.requiredString(record, 'outputRulesJson', `${path}.outputRulesJson`),
      generationPurposesJson: this.requiredString(
        record,
        'generationPurposesJson',
        `${path}.generationPurposesJson`
      ),
      parametersJson: this.optionalString(record, 'parametersJson', `${path}.parametersJson`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isDefault: this.requiredBoolean(record, 'isDefault', `${path}.isDefault`),
      isSensitive: this.optionalBoolean(record, 'isSensitive', false, `${path}.isSensitive`),
      isShared: this.optionalBoolean(record, 'isShared', false, `${path}.isShared`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  /**
   * 人设备份记录 → Prisma 创建输入。
   * @param currentUser 当前登录用户。
   * @param record 人设备份记录。
   * @param path 字段路径。
   * @returns Prisma 人设创建输入。
   */
  private toPersonaImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.UserPersonaCreateManyInput {
    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      name: this.requiredString(record, 'name', `${path}.name`),
      coreIdentity: this.requiredString(record, 'coreIdentity', `${path}.coreIdentity`),
      background: this.requiredString(record, 'background', `${path}.background`),
      interactionPreferences: this.requiredString(
        record,
        'interactionPreferences',
        `${path}.interactionPreferences`
      ),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      isDefault: this.requiredBoolean(record, 'isDefault', `${path}.isDefault`),
      isSensitive: this.optionalBoolean(record, 'isSensitive', false, `${path}.isSensitive`),
      isShared: this.optionalBoolean(record, 'isShared', false, `${path}.isShared`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  /**
   * 会话备份记录 → Prisma 创建输入。
   *
   * characterId 必须存在（强校验）；promptPresetId/personaId
   * 是可选关联，缺失则置 null 并告警。
   *
   * @param currentUser 当前登录用户。
   * @param record 会话备份记录。
   * @param path 字段路径。
   * @param refs 各关联 id 集合。
   * @param warnings 警告收集数组。
   * @returns Prisma 会话创建输入。
   * @throws BadRequestException characterId 引用缺失的角色。
   */
  private toConversationImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string,
    refs: {
      characterIds: Set<string>;
      promptPresetIds: Set<string>;
      personaIds: Set<string>;
    },
    warnings: string[]
  ): Prisma.ConversationCreateManyInput {
    const characterId = this.requiredString(record, 'characterId', `${path}.characterId`);
    // 可选关联：缺失则置 null 并告警
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

    // characterId 是必填关联，引用缺失直接报错
    if (!refs.characterIds.has(characterId)) {
      throw this.invalidFormat(`${path}.characterId references a missing character.`);
    }

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      characterId,
      promptPresetId,
      personaId,
      title: this.requiredString(record, 'title', `${path}.title`),
      status: this.requiredString(record, 'status', `${path}.status`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      usesSensitiveResource: this.optionalBoolean(
        record,
        'usesSensitiveResource',
        false,
        `${path}.usesSensitiveResource`
      ),
      lastMessageAt: this.optionalDate(record, 'lastMessageAt', `${path}.lastMessageAt`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  /**
   * 消息备份记录 → Prisma 创建输入。
   * @param record 消息备份记录。
   * @param path 字段路径。
   * @param conversationIds 会话 id 集合。
   * @returns Prisma 消息创建输入。
   * @throws BadRequestException conversationId 引用缺失的会话。
   */
  private toMessageImportInput(
    record: BackupJsonRecord,
    path: string,
    conversationIds: Set<string>
  ): Prisma.MessageCreateManyInput {
    const conversationId = this.requiredString(record, 'conversationId', `${path}.conversationId`);

    // conversationId 是必填关联，引用缺失直接报错
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

  /**
   * 世界书备份记录 → Prisma 创建输入；角色关联由 WorldBookCharacter 单独恢复。
   * @param currentUser 当前登录用户。
   * @param record 世界书备份记录。
   * @param path 字段路径。
   * @returns Prisma 世界书创建输入。
   */
  private toWorldBookImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.WorldBookCreateManyInput {
    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      userId: currentUser.id,
      name: this.requiredString(record, 'name', `${path}.name`),
      description: this.requiredString(record, 'description', `${path}.description`),
      isEnabled: this.requiredBoolean(record, 'isEnabled', `${path}.isEnabled`),
      isSensitive: this.optionalBoolean(record, 'isSensitive', false, `${path}.isSensitive`),
      scanDepth: this.requiredInteger(record, 'scanDepth', `${path}.scanDepth`),
      tokenBudget: this.requiredInteger(record, 'tokenBudget', `${path}.tokenBudget`),
      metadataJson: this.optionalString(record, 'metadataJson', `${path}.metadataJson`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  /** 从 V2 characterIds 恢复显式多角色关联。 */
  private toWorldBookCharacterImportInputs(
    record: BackupJsonRecord,
    path: string,
    characterIds: Set<string>,
    warnings: string[]
  ): Prisma.WorldBookCharacterCreateManyInput[] {
    const worldBookId = this.requiredString(record, 'id', `${path}.id`);
    const rawCharacterIds = record.characterIds;
    if (!Array.isArray(rawCharacterIds)) {
      throw this.invalidFormat(`${path}.characterIds must be an array.`);
    }
    const ids = rawCharacterIds.map((value, index) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw this.invalidFormat(`${path}.characterIds[${index}] must be a non-empty string.`);
      }
      return value.trim();
    });

    return [...new Set(ids)].flatMap((characterId) => {
      const resolved = this.resolveOptionalReference(
        characterId,
        characterIds,
        `${path}.characterIds`,
        warnings
      );
      return resolved ? [{ worldBookId, characterId: resolved }] : [];
    });
  }

  /**
   * 世界书条目备份记录 → Prisma 创建输入。
   * @param record 条目备份记录。
   * @param path 字段路径。
   * @param worldBookIds 世界书 id 集合。
   * @returns Prisma 世界书条目创建输入。
   * @throws BadRequestException worldBookId 引用缺失的世界书。
   */
  private toWorldBookEntryImportInput(
    record: BackupJsonRecord,
    path: string,
    worldBookIds: Set<string>
  ): Prisma.WorldBookEntryCreateManyInput {
    const worldBookId = this.requiredString(record, 'worldBookId', `${path}.worldBookId`);

    // worldBookId 是必填关联，引用缺失直接报错
    if (!worldBookIds.has(worldBookId)) {
      throw this.invalidFormat(`${path}.worldBookId references a missing world book.`);
    }

    return {
      id: this.requiredString(record, 'id', `${path}.id`),
      worldBookId,
      activeRevisionId: null,
      isEnabled: this.requiredBoolean(record, 'isEnabled', `${path}.isEnabled`),
      createdAt: this.requiredDate(record, 'createdAt', `${path}.createdAt`),
      updatedAt: this.requiredDate(record, 'updatedAt', `${path}.updatedAt`),
      deletedAt: null
    };
  }

  private toWorldBookEntryRevisionImportInput(
    record: BackupJsonRecord,
    path: string
  ): Prisma.WorldBookEntryRevisionCreateManyInput {
    if (!this.isRecord(record.activeRevision)) {
      throw this.invalidFormat(`${path} must be an object.`);
    }
    const revision = record.activeRevision;
    const entryId = this.requiredString(record, 'id', `${path}.entryId`);
    return {
      id: this.requiredString(revision, 'id', `${path}.id`),
      entryId,
      version: this.requiredInteger(revision, 'version', `${path}.version`),
      configJson: this.requiredString(revision, 'configJson', `${path}.configJson`),
      content: this.requiredString(revision, 'content', `${path}.content`),
      compactContent: this.optionalString(revision, 'compactContent', `${path}.compactContent`),
      compactSourceHash: this.optionalString(
        revision,
        'compactSourceHash',
        `${path}.compactSourceHash`
      ),
      contentHash: this.requiredString(revision, 'contentHash', `${path}.contentHash`),
      createdAt: this.requiredDate(revision, 'createdAt', `${path}.createdAt`)
    };
  }

  /**
   * 应用设置备份记录 → Prisma 创建输入数组。
   *
   * 敏感设置（redacted=true 或 key 名匹配敏感模式）跳过，返回空数组。
   * userId 为 null 的保留全局级，否则归当前用户。
   * @param currentUser 当前登录用户。
   * @param record 应用设置备份记录。
   * @param path 字段路径。
   * @returns Prisma 应用设置创建输入数组（敏感设置返回空数组）。
   */
  private toAppSettingImportInput(
    currentUser: CurrentUser,
    record: BackupJsonRecord,
    path: string
  ): Prisma.AppSettingCreateManyInput[] {
    const key = this.requiredString(record, 'key', `${path}.key`);
    // 敏感设置跳过（备份时值已脱敏，恢复无意义）
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

  /**
   * 取记录的可选数组字段；为空返回空数组，存在但非对象数组则报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 记录数组，或空数组。
   */
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

  /**
   * 收集各记录的 id 集合（供关联校验）。
   * @param records 备份记录数组。
   * @returns id 集合。
   */
  private toIdSet(records: BackupJsonRecord[]): Set<string> {
    return new Set(records.map((record) => this.requiredString(record, 'id', 'id')));
  }

  /**
   * 断言各记录 id 唯一。
   * @param records 备份记录数组。
   * @param path 字段路径。
   */
  private assertUniqueIds(records: BackupJsonRecord[], path: string): void {
    this.assertUniqueBy(
      records,
      (record) => this.requiredString(record, 'id', `${path}[].id`),
      path
    );
  }

  /**
   * 断言按 getValue 提取的值唯一；重复则报错。
   * @param records 备份记录数组。
   * @param getValue 提取值的函数。
   * @param path 字段路径。
   * @throws BadRequestException 存在重复值。
   */
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

  /**
   * 解析可选关联：值为空或 id 存在则原样返回；id 不存在则置 null 并告警。
   * @param value 引用的 id。
   * @param availableIds 可用 id 集合。
   * @param path 字段路径。
   * @param warnings 警告收集数组。
   * @returns 原值或 null。
   */
  private resolveOptionalReference(
    value: string | null,
    availableIds: Set<string>,
    path: string,
    warnings: string[]
  ): string | null {
    if (!value || availableIds.has(value)) {
      return value;
    }

    // 引用的 id 不在备份中 → 置 null 并告警
    warnings.push(`${path} references missing id ${value}; restored as null.`);

    return null;
  }

  /**
   * 取必填字符串字段；非字符串报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 字段值。
   */
  private requiredString(record: BackupJsonRecord, field: string, path: string): string {
    const value = record[field];

    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string.`);
    }

    return value;
  }

  /**
   * 取可选字符串字段；null/undefined 返回 null，非字符串报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 字段值，或 null。
   */
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

  /**
   * 取必填布尔字段；非布尔报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 字段值。
   */
  private requiredBoolean(record: BackupJsonRecord, field: string, path: string): boolean {
    const value = record[field];

    if (typeof value !== 'boolean') {
      throw this.invalidFormat(`${path} must be a boolean.`);
    }

    return value;
  }

  /**
   * 取可选布尔字段；null/undefined 返回默认值，非布尔报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param defaultValue 默认值。
   * @param path 字段路径。
   * @returns 字段值或默认值。
   */
  private optionalBoolean(
    record: BackupJsonRecord,
    field: string,
    defaultValue: boolean,
    path: string
  ): boolean {
    const value = record[field];

    if (value === null || value === undefined) {
      return defaultValue;
    }

    if (typeof value !== 'boolean') {
      throw this.invalidFormat(`${path} must be a boolean when present.`);
    }

    return value;
  }

  /**
   * 取必填整数字段；非整数报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 字段值。
   */
  private requiredInteger(record: BackupJsonRecord, field: string, path: string): number {
    const value = record[field];

    if (!Number.isInteger(value)) {
      throw this.invalidFormat(`${path} must be an integer.`);
    }

    return value as number;
  }

  /**
   * 取可选整数字段；null/undefined 返回 null，非整数报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns 字段值，或 null。
   */
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

  /**
   * 取必填日期字段（ISO 字符串 → Date）；非合法日期报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns Date 对象。
   */
  private requiredDate(record: BackupJsonRecord, field: string, path: string): Date {
    const value = record[field];

    if (!this.isIsoDateString(value)) {
      throw this.invalidFormat(`${path} must be an ISO date string.`);
    }

    return new Date(value);
  }

  /**
   * 取可选日期字段；null/undefined 返回 null，非合法日期报错。
   * @param record 备份记录。
   * @param field 字段名。
   * @param path 字段路径。
   * @returns Date 对象，或 null。
   */
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

  /**
   * 类型守卫：值是否是合法 ISO 日期字符串。
   * @param value 任意值。
   * @returns 是合法日期字符串则收窄类型。
   */
  private isIsoDateString(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }

  /**
   * 类型守卫：值是否是普通对象（非 null 非数组）。
   * @param value 任意值。
   * @returns 是普通对象则收窄类型。
   */
  private isRecord(value: unknown): value is BackupJsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 构造格式错误异常（BACKUP_IMPORT_INVALID_FORMAT）。
   * @param message 错误信息。
   * @returns 格式错误异常。
   */
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
