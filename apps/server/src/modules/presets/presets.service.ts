import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PromptPreset } from '@prisma/client';

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
import type { CurrentUser } from '../users/user.types';
import type { CreatePromptPresetDto } from './dto/create-prompt-preset.dto';
import type { QueryPromptPresetsDto } from './dto/query-prompt-presets.dto';
import type { UpdatePromptPresetDto } from './dto/update-prompt-preset.dto';
import type {
  PromptPresetListResponse,
  PromptPresetParams,
  PromptPresetResponse
} from './prompt-preset.types';

type PromptPresetImportPreview = {
  name: string;
  description: string;
  systemPrompt: string;
  outputRules: string;
  parameters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  warnings: ModuleJsonImportWarning[];
  nameConflict: boolean;
  suggestedName: string | null;
};

type PromptPresetImportResponse = {
  imported: boolean;
  preview: PromptPresetImportPreview;
  promptPreset: PromptPresetResponse | null;
};

type NormalizedPromptPresetImport = {
  name: string;
  description: string;
  systemPrompt: string;
  outputRules: string;
  parameters: PromptPresetParams;
  metadata: Record<string, unknown> | null;
  isDefault: boolean;
  warnings: ModuleJsonImportWarning[];
};

/**
 * 预设服务：提示词预设的 CRUD。
 *
 * 与 ModelsService 同构：isDefault=true 时事务内保证默认唯一；
 * 软删除时改名（加 __deleted__ 后缀）释放唯一名约束。
 * 所有查询按 userId 隔离。
 */
@Injectable()
export class PresetsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService
  ) {}

  /**
   * 分页查询当前用户的预设。
   * @param currentUser 当前登录用户（限定只查自己的）。
   * @param query 分页/搜索/默认过滤参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   */
  async list(
    currentUser: CurrentUser,
    query: QueryPromptPresetsDto
  ): Promise<PromptPresetListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(currentUser);
    // 构建查询条件：限定当前用户 + 未软删除
    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(showSensitiveContent ? {} : { isSensitive: false }),
      // isDefault 未传时不加条件，传了则按值过滤
      ...(query.isDefault === undefined ? {} : { isDefault: query.isDefault }),
      // search 关键字：匹配 name/description/outputRules 任一包含
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
              { outputRules: { contains: query.search } }
            ]
          }
        : {})
    };

    // 事务内并行：查当前页 + 统计总数，默认排最前
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promptPreset.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.promptPreset.count({ where })
    ]);

    return {
      items: items.map((preset) => this.toResponse(preset)),
      total,
      page,
      pageSize
    };
  }

  /**
   * 创建预设。
   * @param currentUser 当前登录用户。
   * @param dto 创建入参。
   * @returns 创建后的预设响应。
   * @throws ConflictException 预设名重复。
   */
  async create(
    currentUser: CurrentUser,
    dto: CreatePromptPresetDto
  ): Promise<PromptPresetResponse> {
    const data = {
      userId: currentUser.id,
      name: dto.name,
      // 可选字段未传时落库为空串
      description: dto.description ?? '',
      outputRules: dto.outputRules ?? '',
      // 参数提取后序列化成 JSON 存储
      parametersJson: this.stringifyParams(this.pickParams(dto)),
      isDefault: dto.isDefault ?? false,
      isSensitive: dto.isSensitive ?? false
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认，再创建（保证默认唯一）
      const preset = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
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

            return tx.promptPreset.create({ data });
          })
        : await this.prisma.promptPreset.create({ data });

      return this.toResponse(preset);
    } catch (error) {
      // 捕获唯一名冲突（P2002）转成 409
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 导入 Prompt 预设 JSON：commit=false 只返回预览，commit=true 才创建记录。
   * @param currentUser 当前登录用户。
   * @param dto 导入入参，含 rawJson、commit 和同名处理策略。
   * @returns PromptPresetImportResponse，正式导入时包含新建预设。
   * @throws BadRequestException JSON 非法、格式不符或含敏感字段时抛 400。
   * @throws ConflictException 同名冲突且策略为 reject 时抛 409。
   */
  async importJson(
    currentUser: CurrentUser,
    dto: ImportModuleJsonDto
  ): Promise<PromptPresetImportResponse> {
    const parsed = parseModuleJson(dto.rawJson, 'tavern-lite.prompt-preset.v1');
    const normalized = this.normalizePromptPresetImport(parsed);
    const existingNames = await this.loadExistingNames(currentUser);
    const nameConflict = existingNames.has(normalized.name);
    const suggestedName = nameConflict ? createAvailableName(normalized.name, existingNames) : null;
    const preview: PromptPresetImportPreview = {
      ...normalized,
      parameters: Object.keys(normalized.parameters).length > 0 ? normalized.parameters : null,
      nameConflict,
      suggestedName
    };

    if (!dto.commit) {
      return {
        imported: false,
        preview,
        promptPreset: null
      };
    }

    if (nameConflict && dto.duplicateNameStrategy !== 'rename') {
      throw new ConflictException({
        code: ERROR_CODES.MODULE_IMPORT_NAME_EXISTS,
        message: 'Prompt preset name already exists.',
        details: {
          suggestedName
        }
      });
    }

    const name = nameConflict && suggestedName ? suggestedName : normalized.name;

    try {
      const data = {
        userId: currentUser.id,
        name,
        description: normalized.description,
        systemPrompt: normalized.systemPrompt,
        outputRules: normalized.outputRules,
        parametersJson: this.stringifyParams(normalized.parameters),
        metadataJson: this.stringifyNullable(normalized.metadata),
        isDefault: normalized.isDefault,
        isSensitive: false
      };
      const preset = data.isDefault
        ? await this.prisma.$transaction(async (tx) => {
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

            return tx.promptPreset.create({ data });
          })
        : await this.prisma.promptPreset.create({ data });

      return {
        imported: true,
        preview: {
          ...preview,
          name
        },
        promptPreset: this.toResponse(preset)
      };
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /** 返回可直接用于参数预设导入的模板。 */
  getImportTemplate() {
    return {
      fileName: 'tavern-lite-prompt-preset-template.json',
      template: {
        formatVersion: 'tavern-lite.prompt-preset.v1',
        name: '示例参数预设',
        description: '适用于自然、稳定的日常角色对话。',
        systemPrompt: '',
        outputRules: '使用自然简洁的中文表达，并根据当前场景控制回复长度。',
        parameters: {
          temperature: 0.8,
          topP: 0.9,
          maxTokens: 1200
        },
        metadata: {},
        isDefault: false
      }
    };
  }

  /**
   * 更新预设（部分更新）。
   * @param currentUser 当前登录用户。
   * @param id 预设 ID。
   * @param dto 更新入参，只有传入的字段会被更新。
   * @returns 更新后的预设响应。
   * @throws ConflictException 预设名重复。
   * @throws NotFoundException 预设不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdatePromptPresetDto
  ): Promise<PromptPresetResponse> {
    // 取现有配置，用于合并参数
    const existing = await this.findOwnedActivePromptPreset(currentUser, id);
    // 合并参数：现有参数 + DTO 传入的参数（后者覆盖）
    const params = this.mergeParams(this.parseParams(existing.parametersJson), dto);
    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // 有参数更新才重写 parametersJson
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(dto.outputRules === undefined ? {} : { outputRules: dto.outputRules }),
      ...(this.hasParamUpdate(dto) ? { parametersJson: this.stringifyParams(params) } : {}),
      ...(dto.isSensitive === undefined ? {} : { isSensitive: dto.isSensitive }),
      ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
    };

    try {
      // isDefault=true：事务内先取消该用户其它默认（排除自身），再更新
      const preset = dto.isDefault
        ? await this.prisma.$transaction(async (tx) => {
            await tx.promptPreset.updateMany({
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

            return tx.promptPreset.update({
              where: { id },
              data
            });
          })
        : await this.prisma.promptPreset.update({
            where: { id },
            data
          });

      if (dto.isSensitive !== undefined) {
        await this.refreshConversationSensitivityForPreset(currentUser, id, dto.isSensitive);
      }

      return this.toResponse(preset);
    } catch (error) {
      this.throwIfUniqueNameConflict(error);
      throw error;
    }
  }

  /**
   * 删除预设（软删除）：改名释放唯一名约束 + 取消默认 + 标记删除时间。
   * @param currentUser 当前登录用户。
   * @param id 预设 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 预设不存在或不属于该用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActivePromptPreset(currentUser, id);

    await this.prisma.promptPreset.update({
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
   * 归一化 Prompt 预设导入 JSON。
   * @param record 原始 JSON 对象。
   * @returns 可写入数据库的预设导入数据。
   */
  private normalizePromptPresetImport(record: JsonRecord): NormalizedPromptPresetImport {
    const warnings: ModuleJsonImportWarning[] = [];
    const name = limitText(requiredString(record, 'name', 'name'), 120, 'name', warnings);

    return {
      name,
      description: limitText(
        optionalString(record, 'description', 'description') ?? '',
        500,
        'description',
        warnings
      ),
      systemPrompt: limitText(
        optionalString(record, 'systemPrompt', 'systemPrompt') ?? '',
        10000,
        'systemPrompt',
        warnings
      ),
      outputRules: limitText(
        optionalString(record, 'outputRules', 'outputRules') ?? '',
        4000,
        'outputRules',
        warnings
      ),
      parameters: this.normalizeImportParams(optionalRecord(record, 'parameters', 'parameters')),
      metadata: optionalRecord(record, 'metadata', 'metadata'),
      isDefault: optionalBoolean(record, 'isDefault', false, 'isDefault'),
      warnings
    };
  }

  /**
   * 读取当前用户已有预设名称集合。
   * @param currentUser 当前登录用户。
   * @returns 当前用户未删除预设的名称集合。
   */
  private async loadExistingNames(currentUser: CurrentUser): Promise<Set<string>> {
    const items = await this.prisma.promptPreset.findMany({
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
   * 查询预设并校验所有权：限定 id + 当前用户 + 未删除。
   * @param currentUser 当前登录用户。
   * @param id 预设 ID。
   * @returns 校验通过的预设记录。
   * @throws NotFoundException 不存在/不属于该用户/已删除。
   */
  private async findOwnedActivePromptPreset(
    currentUser: CurrentUser,
    id: string
  ): Promise<PromptPreset> {
    const preset = await this.prisma.promptPreset.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
        ...((await this.settingsService.shouldShowSensitiveContent(currentUser))
          ? {}
          : { isSensitive: false })
      }
    });

    if (!preset) {
      throw new NotFoundException({
        code: ERROR_CODES.PROMPT_PRESET_NOT_FOUND,
        message: 'Prompt preset not found.'
      });
    }

    return preset;
  }

  /**
   * 数据库记录 → 对外响应（解析参数 JSON、格式化时间）。
   * @param preset 预设数据库记录。
   * @returns 预设响应。
   */
  private toResponse(preset: PromptPreset): PromptPresetResponse {
    const params = this.parseParams(preset.parametersJson);

    return {
      id: preset.id,
      userId: preset.userId,
      name: preset.name,
      description: preset.description,
      outputRules: preset.outputRules,
      temperature: params.temperature ?? null,
      topP: params.topP ?? null,
      maxTokens: params.maxTokens ?? null,
      isDefault: preset.isDefault,
      isSensitive: preset.isSensitive,
      createdAt: preset.createdAt.toISOString(),
      updatedAt: preset.updatedAt.toISOString()
    };
  }

  /**
   * 从创建 DTO 提取参数。
   * @param dto 创建入参。
   * @returns 提取出的参数对象。
   */
  private pickParams(dto: CreatePromptPresetDto): PromptPresetParams {
    return this.mergeParams({}, dto);
  }

  /**
   * 合并参数：现有参数 + DTO 参数（后者覆盖），undefined 的跳过。
   * @param existing 现有参数。
   * @param dto DTO（create 或 update）。
   * @returns 合并后的参数对象。
   */
  private mergeParams(
    existing: PromptPresetParams,
    dto: Partial<CreatePromptPresetDto | UpdatePromptPresetDto>
  ): PromptPresetParams {
    return {
      ...(existing.temperature === undefined ? {} : { temperature: existing.temperature }),
      ...(existing.topP === undefined ? {} : { topP: existing.topP }),
      ...(existing.maxTokens === undefined ? {} : { maxTokens: existing.maxTokens }),
      ...(dto.temperature === undefined ? {} : { temperature: dto.temperature }),
      ...(dto.topP === undefined ? {} : { topP: dto.topP }),
      ...(dto.maxTokens === undefined ? {} : { maxTokens: dto.maxTokens })
    };
  }

  /**
   * 判断 DTO 是否含参数更新（决定是否重写 parametersJson）。
   * @param dto 更新入参。
   * @returns 含任一参数字段返回 true。
   */
  private hasParamUpdate(dto: UpdatePromptPresetDto): boolean {
    return dto.temperature !== undefined || dto.topP !== undefined || dto.maxTokens !== undefined;
  }

  /**
   * 参数对象 → JSON 字符串；空对象返回 null。
   * @param params 参数对象。
   * @returns JSON 字符串，空对象返回 null。
   */
  private stringifyParams(params: PromptPresetParams): string | null {
    return Object.keys(params).length > 0 ? JSON.stringify(params) : null;
  }

  /**
   * 导入参数对象归一化，兼容 camelCase 与 OpenAI 风格 snake_case。
   * @param value 原始 parameters 对象。
   * @returns 预设参数对象。
   */
  private normalizeImportParams(value: JsonRecord | null): PromptPresetParams {
    if (!value) {
      return {};
    }

    const params: PromptPresetParams = {};
    const temperature = value.temperature;
    const topP = value.topP ?? value.top_p;
    const maxTokens = value.maxTokens ?? value.max_tokens;

    if (typeof temperature === 'number' && Number.isFinite(temperature)) {
      params.temperature = temperature;
    }

    if (typeof topP === 'number' && Number.isFinite(topP)) {
      params.topP = topP;
    }

    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
      params.maxTokens = Math.trunc(maxTokens);
    }

    return params;
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
   * 解析 parametersJson；为空或解析失败返回空对象，只保留合法数值字段。
   * @param value parametersJson 字符串。
   * @returns 解析后的参数对象。
   */
  private parseParams(value: string | null): PromptPresetParams {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as Partial<PromptPresetParams>;

      return {
        // 各字段校验类型后才保留（防止脏数据）
        ...(typeof parsed.temperature === 'number' ? { temperature: parsed.temperature } : {}),
        ...(typeof parsed.topP === 'number' ? { topP: parsed.topP } : {}),
        ...(Number.isInteger(parsed.maxTokens) ? { maxTokens: parsed.maxTokens } : {})
      };
    } catch {
      return {};
    }
  }

  /**
   * 若是 Prisma 唯一约束冲突（P2002），转成 409 预设名重复；否则什么都不做。
   * @param error 捕获的异常。
   */
  private throwIfUniqueNameConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ERROR_CODES.PROMPT_PRESET_NAME_EXISTS,
        message: 'Prompt preset name already exists.'
      });
    }
  }

  private async refreshConversationSensitivityForPreset(
    currentUser: CurrentUser,
    promptPresetId: string,
    isSensitive: boolean
  ): Promise<void> {
    if (isSensitive) {
      await this.prisma.conversation.updateMany({
        where: {
          userId: currentUser.id,
          promptPresetId,
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
        promptPresetId,
        deletedAt: null,
        character: {
          isSensitive: false
        },
        promptPreset: {
          isSensitive: false
        },
        OR: [{ personaId: null }, { persona: { is: { isSensitive: false } } }]
      },
      data: {
        usesSensitiveResource: false
      }
    });
  }
}
