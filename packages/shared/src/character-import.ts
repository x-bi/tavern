/**
 * 导入时遇到同名角色的处理策略：
 * - `reject` 直接拒绝导入；
 * - `rename` 自动改名为不冲突的名字后导入。
 */
export type CharacterImportDuplicateNameStrategy = 'reject' | 'rename';

/** 角色对话示例的单条消息（用于 mes_example 解析后的规范化表达）。 */
export type CharacterImportExampleMessage = {
  /** 消息角色。 */
  role: 'user' | 'assistant' | 'system';
  /** 消息正文。 */
  content: string;
};

/**
 * 角色导入的入参。
 *
 * 支持两阶段导入：`commit=false` 时仅做预览解析，`commit=true` 时才真正落库。
 */
export type CharacterImportPayload = {
  /** 待导入的角色卡原始 JSON 字符串（V2 结构）。 */
  rawJson: string;
  /** 是否真正落库；默认 false 只做预览。 */
  commit?: boolean;
  /** 同名冲突时的处理策略，默认 reject。 */
  duplicateNameStrategy?: CharacterImportDuplicateNameStrategy;
};

/**
 * 导入时单个字段映射后的处理动作：
 * - `mapped` 成功映射到角色字段；
 * - `metadata` 未能映射，存入 metadata；
 * - `ignored` 主动忽略。
 */
export type CharacterImportFieldAction = 'mapped' | 'metadata' | 'ignored';

/** 单个字段从源到目标的映射记录（供预览展示字段去向）。 */
export type CharacterImportFieldMapping = {
  /** 源字段名（角色卡 JSON 中的路径）。 */
  source: string;
  /** 目标字段名；被忽略时为 null。 */
  target: string | null;
  /** 处理动作。 */
  action: CharacterImportFieldAction;
  /** 附加说明（如忽略原因）。 */
  note?: string;
};

/** 导入过程中的告警项。 */
export type CharacterImportWarning = {
  /** 告警码。 */
  code: string;
  /** 给人看的告警描述。 */
  message: string;
  /** 相关字段名（可选）。 */
  field?: string;
};

/** 角色导入预览结果，展示解析后的字段与冲突信息。 */
export type CharacterImportPreview = {
  /** 角色名。 */
  name: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  /** 场景设定。 */
  scenario: string;
  /** 首条消息。 */
  firstMessage: string;
  /** 规范化后的对话示例。 */
  exampleMessages: CharacterImportExampleMessage[];
  /** 角色元数据（含未能直接映射的字段）。 */
  metadata: Record<string, unknown>;
  /** 各字段的映射去向列表。 */
  fieldMappings: CharacterImportFieldMapping[];
  /** 解析过程中的告警列表。 */
  warnings: CharacterImportWarning[];
  /** 是否与库中已有角色同名。 */
  nameConflict: boolean;
  /** 名字冲突时建议的改名；无冲突时为 null。 */
  suggestedName: string | null;
};

/**
 * 角色导入的响应体。
 *
 * 泛型 `TCharacter` 默认为 unknown，由调用方按各自的角色类型填充。
 */
export type CharacterImportResponse<TCharacter = unknown> = {
  /** 是否真正落库（commit=false 时为 false，仅返回预览）。 */
  imported: boolean;
  /** 解析预览，无论是否落库都会返回。 */
  preview: CharacterImportPreview;
  /** 落库成功后的角色记录；仅预览时为 null。 */
  character: TCharacter | null;
};
