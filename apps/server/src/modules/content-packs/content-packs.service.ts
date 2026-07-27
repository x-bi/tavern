import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { canonicalSha256 } from '../../common/canonical-json';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import { PROMPT_PRESET_DEFAULT_GENERATION_PURPOSES } from '../presets/preset-constants';
import {
  validatePresetGenerationPurposes,
  validatePresetInstructions,
  validatePresetOutputRuleOperations,
  validatePresetParameters
} from '../presets/preset-validation';
import {
  CONTENT_PACK_FORMAT_VERSION,
  type ContentPackDocument,
  type ContentPackDuplicateStrategy,
  type ContentPackImportConflict,
  type ContentPackImportPreview,
  type ContentPackImportResponse,
  type ContentPackImportResult,
  type ContentPackImportSummary,
  type ContentPackImportWarning,
  type ContentPackMessage,
  type ContentPackMessageRole,
  type ContentPackWorldBookEntry
} from './content-pack.types';
import type { ImportContentPackDto } from './dto/import-content-pack.dto';

type JsonRecord = Record<string, unknown>;

const CONTENT_PACK_ROOT_FIELDS = [
  'format',
  'title',
  'description',
  'genre',
  'tone',
  'characters',
  'personas',
  'promptPresets',
  'worldBooks',
  'starterConversations'
] as const;
const CONTENT_PACK_CHARACTER_FIELDS = [
  'ref',
  'name',
  'coreIdentity',
  'personality',
  'persistentPremise',
  'initialScenario',
  'extendedBackground',
  'characterRules',
  'speechStyle',
  'firstMessage',
  'exampleMessages',
  'metadata'
] as const;
const CONTENT_PACK_PERSONA_FIELDS = [
  'ref',
  'name',
  'coreIdentity',
  'background',
  'interactionPreferences',
  'metadata',
  'isDefault'
] as const;
const CONTENT_PACK_PRESET_FIELDS = [
  'ref',
  'name',
  'description',
  'instructions',
  'outputRuleOperations',
  'generationPurposes',
  'parameters',
  'metadata',
  'isDefault'
] as const;
const CONTENT_PACK_WORLD_BOOK_FIELDS = [
  'ref',
  'characterRef',
  'name',
  'description',
  'isEnabled',
  'scanDepth',
  'tokenBudget',
  'metadata',
  'entries'
] as const;
const CONTENT_PACK_WORLD_BOOK_ENTRY_FIELDS = [
  'title',
  'content',
  'keywords',
  'secondaryKeywords',
  'isEnabled',
  'primaryLogic',
  'secondaryLogic',
  'excludeKeywords',
  'sameMessageOnly',
  'scanSources',
  'userHistoryScanDepth',
  'cooldownPolicy',
  'budgetPriority',
  'sortOrder',
  'compactContent',
  'placement',
  'maxTokens',
  'contentType',
  'activationMode',
  'matchMode',
  'stickyTurns',
  'continuationTurns',
  'cooldownTurns',
  'delayTurns',
  'generationPurposes'
] as const;
const CONTENT_PACK_STARTER_CONVERSATION_FIELDS = [
  'ref',
  'title',
  'characterRef',
  'personaRef',
  'promptPresetRef',
  'metadata',
  'messages'
] as const;
const CONTENT_PACK_MESSAGE_FIELDS = ['role', 'content'] as const;
type ContentPackPresetRule = {
  key: string;
  content: string;
  operation: 'add' | 'replace_optional' | 'disable_optional';
  sortOrder: number;
};

type NormalizedCharacter = {
  ref: string;
  name: string;
  coreIdentity: string;
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  firstMessage: string;
  exampleMessages: ContentPackMessage[];
  metadata: JsonRecord | null;
  finalName: string;
  skipped: boolean;
};

type NormalizedPersona = {
  ref: string;
  name: string;
  coreIdentity: string;
  background: string;
  interactionPreferences: string;
  metadata: JsonRecord | null;
  isDefault: boolean;
  finalName: string;
  skipped: boolean;
};

type NormalizedPromptPreset = {
  ref: string;
  name: string;
  description: string;
  instructions: string[];
  outputRuleOperations: ContentPackPresetRule[];
  generationPurposes: string[];
  parameters: JsonRecord | null;
  metadata: JsonRecord | null;
  isDefault: boolean;
  finalName: string;
  skipped: boolean;
};

type NormalizedWorldBook = {
  ref: string;
  characterRef: string | null;
  name: string;
  description: string;
  isEnabled: boolean;
  scanDepth: number;
  tokenBudget: number;
  metadata: JsonRecord | null;
  entries: NormalizedWorldBookEntry[];
  finalName: string;
  skipped: boolean;
};

type NormalizedWorldBookEntry = Required<
  Pick<
    ContentPackWorldBookEntry,
    | 'title'
    | 'content'
    | 'keywords'
    | 'secondaryKeywords'
    | 'isEnabled'
    | 'budgetPriority'
    | 'sortOrder'
  >
> & {
  placement: NonNullable<ContentPackWorldBookEntry['placement']>;
  maxTokens: number | null;
  revisionConfig: JsonRecord;
};

type NormalizedStarterConversation = {
  ref: string;
  title: string;
  characterRef: string;
  personaRef: string | null;
  promptPresetRef: string | null;
  metadata: JsonRecord | null;
  messages: ContentPackMessage[];
  skipped: boolean;
};

type NormalizedContentPack = {
  title: string;
  description: string;
  characters: NormalizedCharacter[];
  personas: NormalizedPersona[];
  promptPresets: NormalizedPromptPreset[];
  worldBooks: NormalizedWorldBook[];
  starterConversations: NormalizedStarterConversation[];
};

type ContentPackImportPlan = NormalizedContentPack & {
  preview: ContentPackImportPreview;
};

/** 同名资源的现有名称集合。 */
type ExistingNameSets = {
  characters: Set<string>;
  personas: Set<string>;
  promptPresets: Set<string>;
  worldBooks: Set<string>;
};

/** 内容包导入服务：解析 AI 生成设定包，预览后按增量方式写入当前用户数据。 */
@Injectable()
export class ContentPacksService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * 导入内容包：解析 JSON → 构建预览计划 → 按 commit 决定是否事务写入。
   *
   * @param currentUser 当前登录用户。
   * @param dto 导入入参；commit=false 只预览，commit=true 正式写入。
   * @returns 内容包导入响应，正式导入时包含新建资源 ID。
   * @throws BadRequestException JSON 非法、格式不符、引用缺失或含敏感字段时抛 400。
   * @throws ConflictException commit=true 且 duplicateStrategy=reject 命中同名冲突时抛 409。
   */
  async importContentPack(
    currentUser: CurrentUser,
    dto: ImportContentPackDto
  ): Promise<ContentPackImportResponse> {
    const duplicateStrategy = dto.duplicateStrategy ?? 'reject';
    const document = this.parseDocument(dto.rawJson);
    const plan = await this.createImportPlan(currentUser, document, duplicateStrategy);

    if (!dto.commit) {
      return {
        imported: false,
        preview: plan.preview,
        result: null
      };
    }

    if (plan.preview.conflicts.some((conflict) => conflict.action === 'reject')) {
      throw new ConflictException({
        code: ERROR_CODES.CONTENT_PACK_IMPORT_NAME_EXISTS,
        message: 'Content pack import has name conflicts. Use rename or skip strategy.'
      });
    }

    const result = await this.commitImportPlan(currentUser, plan);

    return {
      imported: true,
      preview: plan.preview,
      result
    };
  }

  /**
   * 解析并校验内容包根格式。
   * @param rawJson 内容包原始 JSON。
   * @returns 解析后的内容包文档。
   * @throws BadRequestException JSON 非法、根对象非法、版本不匹配或发现敏感字段时抛 400。
   */
  private parseDocument(rawJson: string): ContentPackDocument {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.CONTENT_PACK_IMPORT_INVALID_JSON,
        message: 'Content pack JSON could not be parsed.'
      });
    }

    if (!this.isRecord(parsed)) {
      throw this.invalidFormat('Content pack root must be an object.');
    }

    this.assertAllowedFields(parsed, CONTENT_PACK_ROOT_FIELDS, 'contentPack');

    const sensitivePath = this.findSensitiveFieldPath(parsed);

    if (sensitivePath) {
      throw new BadRequestException({
        code: ERROR_CODES.CONTENT_PACK_IMPORT_SENSITIVE_FIELD,
        message: `Content pack contains a sensitive field: ${sensitivePath}.`,
        details: {
          field: sensitivePath
        }
      });
    }

    if (parsed.format !== CONTENT_PACK_FORMAT_VERSION) {
      throw new BadRequestException({
        code: ERROR_CODES.CONTENT_PACK_IMPORT_INVALID_VERSION,
        message: `Unsupported content pack format: ${String(parsed.format ?? 'missing')}.`,
        details: {
          expected: CONTENT_PACK_FORMAT_VERSION,
          actual: parsed.format ?? null
        }
      });
    }

    if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
      throw this.invalidFormat('title must be a non-empty string.');
    }

    return parsed as ContentPackDocument;
  }

  /**
   * 构建导入计划：归一化字段、校验 ref 关系、处理同名冲突并生成预览。
   * @param currentUser 当前登录用户。
   * @param document 内容包文档。
   * @param duplicateStrategy 同名冲突策略。
   * @returns 可预览、可提交的导入计划。
   */
  private async createImportPlan(
    currentUser: CurrentUser,
    document: ContentPackDocument,
    duplicateStrategy: ContentPackDuplicateStrategy
  ): Promise<ContentPackImportPlan> {
    const warnings: ContentPackImportWarning[] = [];
    const conflicts: ContentPackImportConflict[] = [];
    const existingNames = await this.loadExistingNames(currentUser);
    const pack = this.normalizeDocument(document, warnings);

    this.applyNameResolution(
      pack.characters,
      existingNames.characters,
      'character',
      conflicts,
      duplicateStrategy
    );
    this.applyNameResolution(
      pack.personas,
      existingNames.personas,
      'persona',
      conflicts,
      duplicateStrategy
    );
    this.applyNameResolution(
      pack.promptPresets,
      existingNames.promptPresets,
      'promptPreset',
      conflicts,
      duplicateStrategy
    );
    this.applyNameResolution(
      pack.worldBooks,
      existingNames.worldBooks,
      'worldBook',
      conflicts,
      duplicateStrategy
    );
    this.applyDependencySkips(pack, warnings);

    return {
      ...pack,
      preview: {
        title: pack.title,
        description: pack.description,
        summary: this.createSummary(pack),
        conflicts,
        warnings
      }
    };
  }

  /**
   * 事务提交导入计划。
   *
   * 流程：创建角色/Persona/预设 → 建立 ref 到数据库 ID 的映射 →
   * 创建世界书和条目 → 创建开局会话和初始消息。
   *
   * @param currentUser 当前登录用户。
   * @param plan 导入计划。
   * @returns 正式写入后的新建资源 ID 列表。
   */
  private async commitImportPlan(
    currentUser: CurrentUser,
    plan: ContentPackImportPlan
  ): Promise<ContentPackImportResult> {
    return this.prisma.$transaction(async (tx) => {
      const characterIds = new Map<string, string>();
      const personaIds = new Map<string, string>();
      const promptPresetIds = new Map<string, string>();
      const worldBookIds = new Map<string, string>();
      const result: ContentPackImportResult = {
        characterIds: [],
        personaIds: [],
        promptPresetIds: [],
        worldBookIds: [],
        conversationIds: []
      };

      for (const character of plan.characters.filter((item) => !item.skipped)) {
        const created = await tx.character.create({
          data: {
            userId: currentUser.id,
            name: character.finalName,
            coreIdentity: character.coreIdentity,
            personality: character.personality,
            persistentPremise: character.persistentPremise,
            initialScenario: character.initialScenario,
            extendedBackground: character.extendedBackground,
            characterRules: character.characterRules,
            speechStyle: character.speechStyle,
            firstMessage: character.firstMessage,
            exampleMessagesJson: this.stringifyNullable(character.exampleMessages),
            metadataJson: this.stringifyNullable(character.metadata),
            isSensitive: false,
            isArchived: false
          }
        });

        characterIds.set(character.ref, created.id);
        result.characterIds.push(created.id);
      }

      for (const persona of plan.personas.filter((item) => !item.skipped)) {
        if (persona.isDefault) {
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
        }

        const created = await tx.userPersona.create({
          data: {
            userId: currentUser.id,
            name: persona.finalName,
            coreIdentity: persona.coreIdentity,
            background: persona.background,
            interactionPreferences: persona.interactionPreferences,
            metadataJson: this.stringifyNullable(persona.metadata),
            isDefault: persona.isDefault,
            isSensitive: false
          }
        });

        personaIds.set(persona.ref, created.id);
        result.personaIds.push(created.id);
      }

      for (const preset of plan.promptPresets.filter((item) => !item.skipped)) {
        if (preset.isDefault) {
          await tx.promptPreset.updateMany({
            where: {
              userId: currentUser.id,
              deletedAt: null,
              isDefault: true
            },
            data: {
              isDefault: false
            }
          });
        }

        const created = await tx.promptPreset.create({
          data: {
            userId: currentUser.id,
            name: preset.finalName,
            description: preset.description,
            instructionsJson: JSON.stringify(preset.instructions),
            outputRuleOperationsJson: JSON.stringify(preset.outputRuleOperations),
            generationPurposesJson: JSON.stringify(preset.generationPurposes),
            parametersJson: this.stringifyNullable(preset.parameters),
            metadataJson: this.stringifyNullable(preset.metadata),
            isDefault: preset.isDefault,
            isSensitive: false
          }
        });

        promptPresetIds.set(preset.ref, created.id);
        result.promptPresetIds.push(created.id);
      }

      for (const worldBook of plan.worldBooks.filter((item) => !item.skipped)) {
        const created = await tx.worldBook.create({
          data: {
            userId: currentUser.id,
            name: worldBook.finalName,
            description: worldBook.description,
            isEnabled: worldBook.isEnabled,
            isSensitive: false,
            scanDepth: worldBook.scanDepth,
            tokenBudget: worldBook.tokenBudget,
            metadataJson: this.stringifyNullable(worldBook.metadata),
            ...(worldBook.characterRef
              ? {
                  characterLinks: {
                    create: {
                      characterId: characterIds.get(worldBook.characterRef)!
                    }
                  }
                }
              : {})
          }
        });

        worldBookIds.set(worldBook.ref, created.id);
        result.worldBookIds.push(created.id);

        if (worldBook.entries.length > 0) {
          for (const entry of worldBook.entries) {
            const createdEntry = await tx.worldBookEntry.create({
              data: {
                worldBookId: created.id,
                isEnabled: entry.isEnabled
              }
            });
            const revision = await tx.worldBookEntryRevision.create({
              data: {
                entryId: createdEntry.id,
                version: 1,
                configJson: JSON.stringify(entry.revisionConfig),
                content: entry.content,
                compactContent: entry.revisionConfig.compactContent
                  ? String(entry.revisionConfig.compactContent)
                  : null,
                contentHash: canonicalSha256(entry.content)
              }
            });
            await tx.worldBookEntry.update({
              where: { id: createdEntry.id },
              data: { activeRevisionId: revision.id }
            });
          }
        }
      }

      for (const conversation of plan.starterConversations.filter((item) => !item.skipped)) {
        const now = new Date();
        const created = await tx.conversation.create({
          data: {
            userId: currentUser.id,
            characterId: characterIds.get(conversation.characterRef)!,
            personaId: conversation.personaRef
              ? (personaIds.get(conversation.personaRef) ?? null)
              : null,
            promptPresetId: conversation.promptPresetRef
              ? (promptPresetIds.get(conversation.promptPresetRef) ?? null)
              : null,
            title: conversation.title,
            status: 'active',
            usesSensitiveResource: false,
            metadataJson: this.stringifyNullable(conversation.metadata),
            lastMessageAt: conversation.messages.length > 0 ? now : null
          }
        });

        result.conversationIds.push(created.id);

        if (conversation.messages.length > 0) {
          await tx.message.createMany({
            data: conversation.messages.map((message) => ({
              conversationId: created.id,
              role: message.role,
              content: message.content,
              status: 'complete',
              metadataJson: null,
              tokenCount: null,
              createdAt: now,
              updatedAt: now
            }))
          });
        }
      }

      return result;
    });
  }

  /**
   * 将外部内容包文档归一化为内部计划形态。
   * @param document 内容包文档。
   * @param warnings 归一化过程中的告警收集数组。
   * @returns 归一化后的内容包。
   */
  private normalizeDocument(
    document: ContentPackDocument,
    warnings: ContentPackImportWarning[]
  ): NormalizedContentPack {
    const characters = this.getRecordArray(document.characters, 'characters').map((record, index) =>
      this.normalizeCharacter(record, `characters[${index}]`, warnings)
    );
    const personas = this.getRecordArray(document.personas, 'personas').map((record, index) =>
      this.normalizePersona(record, `personas[${index}]`, warnings)
    );
    const promptPresets = this.getRecordArray(document.promptPresets, 'promptPresets').map(
      (record, index) => this.normalizePromptPreset(record, `promptPresets[${index}]`, warnings)
    );
    const worldBooks = this.getRecordArray(document.worldBooks, 'worldBooks').map((record, index) =>
      this.normalizeWorldBook(record, `worldBooks[${index}]`, warnings)
    );
    const starterConversations = this.getRecordArray(
      document.starterConversations,
      'starterConversations'
    ).map((record, index) =>
      this.normalizeStarterConversation(record, `starterConversations[${index}]`, warnings)
    );

    this.assertUniqueRefs(characters, 'characters');
    this.assertUniqueRefs(personas, 'personas');
    this.assertUniqueRefs(promptPresets, 'promptPresets');
    this.assertUniqueRefs(worldBooks, 'worldBooks');
    this.assertUniqueRefs(starterConversations, 'starterConversations');
    this.assertReferences(characters, personas, promptPresets, worldBooks, starterConversations);

    return {
      title: this.limitText(document.title.trim(), 120, 'title', warnings),
      description:
        typeof document.description === 'string'
          ? this.limitText(document.description.trim(), 10000, 'description', warnings)
          : '',
      characters,
      personas,
      promptPresets,
      worldBooks,
      starterConversations
    };
  }

  private normalizeCharacter(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedCharacter {
    this.assertAllowedFields(record, CONTENT_PACK_CHARACTER_FIELDS, path);
    const name = this.requiredLimitedString(record, 'name', `${path}.name`, 120, warnings);

    return {
      ref: this.requiredString(record, 'ref', `${path}.ref`),
      name,
      finalName: name,
      coreIdentity: this.optionalLimitedString(
        record,
        'coreIdentity',
        `${path}.coreIdentity`,
        warnings
      ),
      personality: this.optionalLimitedString(
        record,
        'personality',
        `${path}.personality`,
        warnings
      ),
      persistentPremise: this.optionalLimitedString(
        record,
        'persistentPremise',
        `${path}.persistentPremise`,
        warnings
      ),
      initialScenario: this.optionalLimitedString(
        record,
        'initialScenario',
        `${path}.initialScenario`,
        warnings
      ),
      extendedBackground: this.optionalLimitedString(
        record,
        'extendedBackground',
        `${path}.extendedBackground`,
        warnings
      ),
      characterRules: this.optionalLimitedString(
        record,
        'characterRules',
        `${path}.characterRules`,
        warnings
      ),
      speechStyle: this.optionalLimitedString(
        record,
        'speechStyle',
        `${path}.speechStyle`,
        warnings
      ),
      firstMessage: this.optionalLimitedString(
        record,
        'firstMessage',
        `${path}.firstMessage`,
        warnings
      ),
      exampleMessages: this.normalizeMessages(
        record.exampleMessages,
        `${path}.exampleMessages`,
        warnings
      ),
      metadata: this.optionalRecord(record, 'metadata', `${path}.metadata`),
      skipped: false
    };
  }

  private normalizePersona(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedPersona {
    this.assertAllowedFields(record, CONTENT_PACK_PERSONA_FIELDS, path);
    const name = this.requiredLimitedString(record, 'name', `${path}.name`, 120, warnings);

    return {
      ref: this.requiredString(record, 'ref', `${path}.ref`),
      name,
      finalName: name,
      coreIdentity: this.optionalLimitedString(
        record,
        'coreIdentity',
        `${path}.coreIdentity`,
        warnings
      ),
      background: this.optionalLimitedString(record, 'background', `${path}.background`, warnings),
      interactionPreferences: this.optionalLimitedString(
        record,
        'interactionPreferences',
        `${path}.interactionPreferences`,
        warnings
      ),
      metadata: this.optionalRecord(record, 'metadata', `${path}.metadata`),
      isDefault: this.optionalBoolean(record, 'isDefault', false, `${path}.isDefault`),
      skipped: false
    };
  }

  private normalizePromptPreset(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedPromptPreset {
    this.assertAllowedFields(record, CONTENT_PACK_PRESET_FIELDS, path);
    const name = this.requiredLimitedString(record, 'name', `${path}.name`, 120, warnings);

    // 内容包预设字段缺失时回退默认值（内容包是聚合包，字段可选），
    // 但只要字段存在就严格校验，与独立预设导入同口径（见清理方案 §5.9）。
    const instructions =
      record.instructions === undefined || record.instructions === null
        ? []
        : validatePresetInstructions(record.instructions, `${path}.instructions`);
    const outputRuleOperations =
      record.outputRuleOperations === undefined || record.outputRuleOperations === null
        ? []
        : validatePresetOutputRuleOperations(
            record.outputRuleOperations,
            `${path}.outputRuleOperations`
          );
    const generationPurposes =
      record.generationPurposes === undefined || record.generationPurposes === null
        ? [...PROMPT_PRESET_DEFAULT_GENERATION_PURPOSES]
        : validatePresetGenerationPurposes(record.generationPurposes, `${path}.generationPurposes`);

    return {
      ref: this.requiredString(record, 'ref', `${path}.ref`),
      name,
      finalName: name,
      description: this.optionalLimitedString(
        record,
        'description',
        `${path}.description`,
        warnings
      ),
      instructions,
      outputRuleOperations,
      generationPurposes,
      parameters: validatePresetParameters(record.parameters, `${path}.parameters`),
      metadata: this.optionalRecord(record, 'metadata', `${path}.metadata`),
      isDefault: this.optionalBoolean(record, 'isDefault', false, `${path}.isDefault`),
      skipped: false
    };
  }

  private normalizeWorldBook(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedWorldBook {
    this.assertAllowedFields(record, CONTENT_PACK_WORLD_BOOK_FIELDS, path);
    const name = this.requiredLimitedString(record, 'name', `${path}.name`, 120, warnings);
    const entries = this.getRecordArray(record.entries, `${path}.entries`).map((entry, index) =>
      this.normalizeWorldBookEntry(entry, `${path}.entries[${index}]`, warnings)
    );

    return {
      ref: this.requiredString(record, 'ref', `${path}.ref`),
      characterRef: this.optionalString(record, 'characterRef', `${path}.characterRef`),
      name,
      finalName: name,
      description: this.optionalLimitedString(
        record,
        'description',
        `${path}.description`,
        warnings
      ),
      isEnabled: this.optionalBoolean(record, 'isEnabled', true, `${path}.isEnabled`),
      scanDepth: this.optionalInteger(record, 'scanDepth', 6, `${path}.scanDepth`),
      tokenBudget: this.optionalInteger(record, 'tokenBudget', 1000, `${path}.tokenBudget`),
      metadata: this.optionalRecord(record, 'metadata', `${path}.metadata`),
      entries,
      skipped: false
    };
  }

  private normalizeWorldBookEntry(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedWorldBookEntry {
    this.assertAllowedFields(record, CONTENT_PACK_WORLD_BOOK_ENTRY_FIELDS, path);
    const keywords = this.requiredStringArray(record, 'keywords', `${path}.keywords`);

    if (keywords.length === 0) {
      throw this.invalidFormat(`${path}.keywords must contain at least one string.`);
    }
    const requestedContentType =
      record.contentType === 'behavior_rule' ? 'lore' : String(record.contentType ?? 'lore');
    const placement = this.normalizePlacement(
      record.placement,
      this.defaultPlacementForContentType(requestedContentType),
      `${path}.placement`
    );

    return {
      title: this.requiredLimitedString(record, 'title', `${path}.title`, 120, warnings),
      content: this.requiredLimitedString(record, 'content', `${path}.content`, 10000, warnings),
      keywords,
      secondaryKeywords: this.optionalStringArray(
        record,
        'secondaryKeywords',
        `${path}.secondaryKeywords`
      ),
      isEnabled: this.optionalBoolean(record, 'isEnabled', true, `${path}.isEnabled`),
      budgetPriority: this.optionalInteger(record, 'budgetPriority', 0, `${path}.budgetPriority`),
      sortOrder: this.optionalInteger(record, 'sortOrder', 0, `${path}.sortOrder`),
      placement,
      maxTokens: this.optionalNullableInteger(record, 'maxTokens', `${path}.maxTokens`),
      revisionConfig: {
        contentType: requestedContentType,
        trustLevel: 'imported_untrusted',
        activationMode: record.activationMode ?? 'keyword',
        matchMode: record.matchMode ?? 'normalized_phrase',
        primaryKeywords: keywords,
        primaryLogic: record.primaryLogic ?? 'any',
        secondaryKeywords: this.optionalStringArray(
          record,
          'secondaryKeywords',
          `${path}.secondaryKeywords`
        ),
        secondaryLogic: record.secondaryLogic ?? 'and_any',
        excludeKeywords: this.optionalStringArray(
          record,
          'excludeKeywords',
          `${path}.excludeKeywords`
        ),
        sameMessageOnly: this.optionalBoolean(
          record,
          'sameMessageOnly',
          true,
          `${path}.sameMessageOnly`
        ),
        scanSources: this.optionalStringArray(record, 'scanSources', `${path}.scanSources`).length
          ? this.optionalStringArray(record, 'scanSources', `${path}.scanSources`)
          : ['current_user', 'user_history', 'assistant_latest'],
        userHistoryScanDepth: this.optionalInteger(
          record,
          'userHistoryScanDepth',
          6,
          `${path}.userHistoryScanDepth`
        ),
        stickyTurns: this.optionalInteger(record, 'stickyTurns', 0, `${path}.stickyTurns`),
        continuationTurns: this.optionalInteger(
          record,
          'continuationTurns',
          1,
          `${path}.continuationTurns`
        ),
        cooldownTurns: this.optionalInteger(record, 'cooldownTurns', 0, `${path}.cooldownTurns`),
        delayTurns: this.optionalInteger(record, 'delayTurns', 0, `${path}.delayTurns`),
        cooldownPolicy: record.cooldownPolicy ?? 'strict',
        generationPurposes:
          record.generationPurposes === undefined || record.generationPurposes === null
            ? ['chat_reply', 'regenerate', 'continue']
            : this.optionalStringArray(record, 'generationPurposes', `${path}.generationPurposes`),
        budgetPriority: this.optionalInteger(record, 'budgetPriority', 0, `${path}.budgetPriority`),
        sortOrder: this.optionalInteger(record, 'sortOrder', 0, `${path}.sortOrder`),
        placement,
        maxTokens: this.optionalNullableInteger(record, 'maxTokens', `${path}.maxTokens`),
        compactContent: this.optionalString(record, 'compactContent', `${path}.compactContent`)
      }
    };
  }

  private normalizeStarterConversation(
    record: JsonRecord,
    path: string,
    warnings: ContentPackImportWarning[]
  ): NormalizedStarterConversation {
    this.assertAllowedFields(record, CONTENT_PACK_STARTER_CONVERSATION_FIELDS, path);
    return {
      ref: this.requiredString(record, 'ref', `${path}.ref`),
      title: this.requiredLimitedString(record, 'title', `${path}.title`, 120, warnings),
      characterRef: this.requiredString(record, 'characterRef', `${path}.characterRef`),
      personaRef: this.optionalString(record, 'personaRef', `${path}.personaRef`),
      promptPresetRef: this.optionalString(record, 'promptPresetRef', `${path}.promptPresetRef`),
      metadata: this.optionalRecord(record, 'metadata', `${path}.metadata`),
      messages: this.normalizeMessages(record.messages, `${path}.messages`, warnings),
      skipped: false
    };
  }

  /**
   * 查询当前用户已有资源名，用于内容包导入前的冲突预览。
   * @param currentUser 当前登录用户。
   * @returns 四类资源的现有名称集合。
   */
  private async loadExistingNames(currentUser: CurrentUser): Promise<ExistingNameSets> {
    const [characters, personas, promptPresets, worldBooks] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      }),
      this.prisma.userPersona.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      }),
      this.prisma.promptPreset.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      }),
      this.prisma.worldBook.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { name: true }
      })
    ]);

    return {
      characters: new Set(characters.map((item) => item.name)),
      personas: new Set(personas.map((item) => item.name)),
      promptPresets: new Set(promptPresets.map((item) => item.name)),
      worldBooks: new Set(worldBooks.map((item) => item.name))
    };
  }

  private applyNameResolution<T extends { name: string; finalName: string; skipped: boolean }>(
    items: T[],
    usedNames: Set<string>,
    type: ContentPackImportConflict['type'],
    conflicts: ContentPackImportConflict[],
    duplicateStrategy: ContentPackDuplicateStrategy
  ): void {
    for (const item of items) {
      if (!usedNames.has(item.name)) {
        usedNames.add(item.name);
        continue;
      }

      const suggestedName = this.createAvailableName(item.name, usedNames);

      conflicts.push({
        type,
        name: item.name,
        action: duplicateStrategy,
        suggestedName
      });

      if (duplicateStrategy === 'rename') {
        item.finalName = suggestedName;
        usedNames.add(suggestedName);
      } else if (duplicateStrategy === 'skip') {
        item.skipped = true;
      }
    }
  }

  private applyDependencySkips(
    pack: NormalizedContentPack,
    warnings: ContentPackImportWarning[]
  ): void {
    const skippedCharacterRefs = new Set(
      pack.characters.filter((item) => item.skipped).map((item) => item.ref)
    );
    const skippedPersonaRefs = new Set(
      pack.personas.filter((item) => item.skipped).map((item) => item.ref)
    );
    const skippedPresetRefs = new Set(
      pack.promptPresets.filter((item) => item.skipped).map((item) => item.ref)
    );

    for (const worldBook of pack.worldBooks) {
      if (worldBook.characterRef && skippedCharacterRefs.has(worldBook.characterRef)) {
        worldBook.skipped = true;
        warnings.push({
          code: 'DEPENDENCY_SKIPPED',
          path: `worldBooks.${worldBook.ref}.characterRef`,
          message: `世界书 ${worldBook.name} 依赖的角色已跳过，因此世界书也被跳过。`
        });
      }
    }

    for (const conversation of pack.starterConversations) {
      const missingCharacter = skippedCharacterRefs.has(conversation.characterRef);
      const missingPersona = conversation.personaRef
        ? skippedPersonaRefs.has(conversation.personaRef)
        : false;
      const missingPreset = conversation.promptPresetRef
        ? skippedPresetRefs.has(conversation.promptPresetRef)
        : false;

      if (missingCharacter || missingPersona || missingPreset) {
        conversation.skipped = true;
        warnings.push({
          code: 'DEPENDENCY_SKIPPED',
          path: `starterConversations.${conversation.ref}`,
          message: `开局会话 ${conversation.title} 的依赖资源已跳过，因此会话也被跳过。`
        });
      }
    }
  }

  private assertReferences(
    characters: NormalizedCharacter[],
    personas: NormalizedPersona[],
    promptPresets: NormalizedPromptPreset[],
    worldBooks: NormalizedWorldBook[],
    starterConversations: NormalizedStarterConversation[]
  ): void {
    const characterRefs = new Set(characters.map((item) => item.ref));
    const personaRefs = new Set(personas.map((item) => item.ref));
    const promptPresetRefs = new Set(promptPresets.map((item) => item.ref));

    for (const worldBook of worldBooks) {
      if (worldBook.characterRef && !characterRefs.has(worldBook.characterRef)) {
        throw this.invalidFormat(
          `worldBooks.${worldBook.ref}.characterRef references a missing character.`
        );
      }
    }

    for (const conversation of starterConversations) {
      if (!characterRefs.has(conversation.characterRef)) {
        throw this.invalidFormat(
          `starterConversations.${conversation.ref}.characterRef references a missing character.`
        );
      }

      if (conversation.personaRef && !personaRefs.has(conversation.personaRef)) {
        throw this.invalidFormat(
          `starterConversations.${conversation.ref}.personaRef references a missing persona.`
        );
      }

      if (conversation.promptPresetRef && !promptPresetRefs.has(conversation.promptPresetRef)) {
        throw this.invalidFormat(
          `starterConversations.${conversation.ref}.promptPresetRef references a missing prompt preset.`
        );
      }
    }
  }

  private createSummary(pack: NormalizedContentPack): ContentPackImportSummary {
    const worldBooks = pack.worldBooks.filter((item) => !item.skipped);
    const conversations = pack.starterConversations.filter((item) => !item.skipped);

    return {
      characters: pack.characters.filter((item) => !item.skipped).length,
      personas: pack.personas.filter((item) => !item.skipped).length,
      promptPresets: pack.promptPresets.filter((item) => !item.skipped).length,
      worldBooks: worldBooks.length,
      worldBookEntries: worldBooks.reduce(
        (total, worldBook) => total + worldBook.entries.length,
        0
      ),
      conversations: conversations.length,
      messages: conversations.reduce(
        (total, conversation) => total + conversation.messages.length,
        0
      ),
      skipped:
        pack.characters.filter((item) => item.skipped).length +
        pack.personas.filter((item) => item.skipped).length +
        pack.promptPresets.filter((item) => item.skipped).length +
        pack.worldBooks.filter((item) => item.skipped).length +
        pack.starterConversations.filter((item) => item.skipped).length
    };
  }

  private normalizeMessages(
    value: unknown,
    path: string,
    warnings: ContentPackImportWarning[]
  ): ContentPackMessage[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw this.invalidFormat(`${path} must be an array when present.`);
    }

    return value.map((item, index) => {
      const record = this.asRecord(item, `${path}[${index}]`);
      this.assertAllowedFields(record, CONTENT_PACK_MESSAGE_FIELDS, `${path}[${index}]`);
      const role = this.requiredString(record, 'role', `${path}[${index}].role`);

      if (!this.isContentPackMessageRole(role)) {
        throw this.invalidFormat(`${path}[${index}].role must be system, user or assistant.`);
      }

      return {
        role,
        content: this.requiredLimitedString(
          record,
          'content',
          `${path}[${index}].content`,
          10000,
          warnings
        )
      };
    });
  }

  private normalizePlacement(
    value: unknown,
    fallback: NormalizedWorldBookEntry['placement'],
    path: string
  ): NormalizedWorldBookEntry['placement'] {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string when present.`);
    }

    if (
      value === 'instruction' ||
      value === 'before_history' ||
      value === 'after_history' ||
      value === 'before_current_user'
    ) {
      return value;
    }

    throw this.invalidFormat(
      `${path} has unsupported placement: ${value}. Allowed values: instruction, before_history, after_history, before_current_user.`
    );
  }

  private defaultPlacementForContentType(
    contentType: string
  ): NormalizedWorldBookEntry['placement'] {
    if (contentType === 'state') return 'before_current_user';
    if (contentType === 'behavior_rule') return 'instruction';
    if (contentType === 'reference') return 'after_history';
    return 'before_history';
  }

  private getRecordArray(value: unknown, path: string): JsonRecord[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw this.invalidFormat(`${path} must be an array.`);
    }

    return value.map((item, index) => this.asRecord(item, `${path}[${index}]`));
  }

  private asRecord(value: unknown, path: string): JsonRecord {
    if (!this.isRecord(value)) {
      throw this.invalidFormat(`${path} must be an object.`);
    }

    return value;
  }

  private assertUniqueRefs(items: Array<{ ref: string }>, path: string): void {
    const refs = new Set<string>();

    for (const item of items) {
      if (refs.has(item.ref)) {
        throw this.invalidFormat(`${path} contains duplicate ref: ${item.ref}.`);
      }

      refs.add(item.ref);
    }
  }

  private requiredString(record: JsonRecord, field: string, path: string): string {
    const value = record[field];

    if (typeof value !== 'string' || !value.trim()) {
      throw this.invalidFormat(`${path} must be a non-empty string.`);
    }

    return value.trim();
  }

  private requiredLimitedString(
    record: JsonRecord,
    field: string,
    path: string,
    maxLength: number,
    warnings: ContentPackImportWarning[]
  ): string {
    return this.limitText(this.requiredString(record, field, path), maxLength, path, warnings);
  }

  private optionalString(record: JsonRecord, field: string, path: string): string | null {
    const value = record[field];

    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.invalidFormat(`${path} must be a string or null.`);
    }

    return value.trim() || null;
  }

  private optionalLimitedString(
    record: JsonRecord,
    field: string,
    path: string,
    warnings: ContentPackImportWarning[]
  ): string {
    return this.limitText(this.optionalString(record, field, path) ?? '', 10000, path, warnings);
  }

  private optionalRecord(record: JsonRecord, field: string, path: string): JsonRecord | null {
    const value = record[field];

    if (value === undefined || value === null) {
      return null;
    }

    return this.asRecord(value, path);
  }

  private optionalBoolean(
    record: JsonRecord,
    field: string,
    defaultValue: boolean,
    path: string
  ): boolean {
    const value = record[field];

    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (typeof value !== 'boolean') {
      throw this.invalidFormat(`${path} must be a boolean when present.`);
    }

    return value;
  }

  private optionalInteger(
    record: JsonRecord,
    field: string,
    defaultValue: number,
    path: string
  ): number {
    const value = record[field];

    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (!Number.isInteger(value)) {
      throw this.invalidFormat(`${path} must be an integer when present.`);
    }

    return value as number;
  }

  private optionalNullableInteger(record: JsonRecord, field: string, path: string): number | null {
    const value = record[field];

    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value)) {
      throw this.invalidFormat(`${path} must be an integer or null.`);
    }

    return value as number;
  }

  private requiredStringArray(record: JsonRecord, field: string, path: string): string[] {
    const value = record[field];

    if (!Array.isArray(value)) {
      throw this.invalidFormat(`${path} must be a string array.`);
    }

    return value.map((item, index) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw this.invalidFormat(`${path}[${index}] must be a non-empty string.`);
      }

      return item.trim();
    });
  }

  private optionalStringArray(record: JsonRecord, field: string, path: string): string[] {
    const value = record[field];

    if (value === undefined || value === null) {
      return [];
    }

    return this.requiredStringArray(record, field, path);
  }

  private limitText(
    value: string,
    maxLength: number,
    path: string,
    warnings: ContentPackImportWarning[]
  ): string {
    if (value.length <= maxLength) {
      return value;
    }

    warnings.push({
      code: 'FIELD_TRUNCATED',
      path,
      message: `${path} 超过 ${maxLength} 个字符，已截断。`
    });

    return value.slice(0, maxLength);
  }

  private createAvailableName(baseName: string, usedNames: Set<string>): string {
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${baseName} (${index})`;

      if (!usedNames.has(candidate)) {
        return candidate;
      }
    }

    return `${baseName} (${Date.now()})`;
  }

  private findSensitiveFieldPath(value: unknown, path = '$'): string | null {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = this.findSensitiveFieldPath(value[index], `${path}[${index}]`);

        if (found) {
          return found;
        }
      }

      return null;
    }

    if (!this.isRecord(value)) {
      return null;
    }

    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;

      if (this.isSensitiveFieldName(key)) {
        return childPath;
      }

      const found = this.findSensitiveFieldPath(child, childPath);

      if (found) {
        return found;
      }
    }

    return null;
  }

  private isSensitiveFieldName(field: string): boolean {
    return /api[_-]?key|secret|password|authorization|access[_-]?token|refresh[_-]?token|bearer/i.test(
      field
    );
  }

  private isContentPackMessageRole(role: string): role is ContentPackMessageRole {
    return role === 'system' || role === 'user' || role === 'assistant';
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** V2 导入对象只接受契约字段；旧字段和拼写错误均直接拒绝。 */
  private assertAllowedFields(
    record: JsonRecord,
    allowedFields: readonly string[],
    path: string
  ): void {
    const allowed = new Set(allowedFields);
    const unknown = Object.keys(record).find((field) => !allowed.has(field));

    if (unknown) {
      throw this.invalidFormat(`${path}.${unknown} is not supported by the V2 format.`);
    }
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  private invalidFormat(message: string): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODES.CONTENT_PACK_IMPORT_INVALID_FORMAT,
      message,
      details: {
        expectedFormat: CONTENT_PACK_FORMAT_VERSION
      }
    });
  }
}
