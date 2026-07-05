/** 单模块 JSON 导入时遇到同名资源的处理策略。 */
export type ModuleImportDuplicateNameStrategy = 'reject' | 'rename';

/** 单模块 JSON 导入入参。 */
export type ModuleImportPayload = {
  /** 原始 JSON 字符串。 */
  rawJson: string;
  /** 是否真正落库；默认 false 只做预览。 */
  commit?: boolean;
  /** 同名冲突策略，默认 reject。 */
  duplicateNameStrategy?: ModuleImportDuplicateNameStrategy;
};

/** 单模块 JSON 导入告警。 */
export type ModuleImportWarning = {
  /** 告警码。 */
  code: string;
  /** 给人看的告警说明。 */
  message: string;
  /** 相关字段路径。 */
  field?: string;
};

/** 单模块 JSON 导入预览基础字段。 */
export type ModuleImportPreviewBase = {
  /** 导入对象名称。 */
  name: string;
  /** 是否与当前库中已有对象同名。 */
  nameConflict: boolean;
  /** 同名时建议的可用名称；无冲突时为 null。 */
  suggestedName: string | null;
  /** 导入过程告警。 */
  warnings: ModuleImportWarning[];
};

/** Persona JSON 导入预览。 */
export type PersonaImportPreview = ModuleImportPreviewBase & {
  /** Persona 正文。 */
  content: string;
  /** 扩展元数据。 */
  metadata: Record<string, unknown> | null;
  /** 是否设为默认。 */
  isDefault: boolean;
};

/** Persona JSON 导入响应。 */
export type PersonaImportResponse<TPersona = unknown> = {
  /** 是否已真正落库。 */
  imported: boolean;
  /** 导入预览。 */
  preview: PersonaImportPreview;
  /** 正式导入后的 Persona；预览时为 null。 */
  persona: TPersona | null;
};

/** Prompt 预设 JSON 导入预览。 */
export type PromptPresetImportPreview = ModuleImportPreviewBase & {
  /** 预设说明。 */
  description: string;
  /** 系统 Prompt。 */
  systemPrompt: string;
  /** 输出规则。 */
  outputRules: string;
  /** 参数 JSON。 */
  parameters: Record<string, unknown> | null;
  /** 扩展元数据。 */
  metadata: Record<string, unknown> | null;
  /** 是否设为默认。 */
  isDefault: boolean;
};

/** Prompt 预设 JSON 导入响应。 */
export type PromptPresetImportResponse<TPreset = unknown> = {
  /** 是否已真正落库。 */
  imported: boolean;
  /** 导入预览。 */
  preview: PromptPresetImportPreview;
  /** 正式导入后的预设；预览时为 null。 */
  promptPreset: TPreset | null;
};

/** 世界书条目 JSON 导入预览。 */
export type WorldBookEntryImportPreview = {
  /** 条目标题。 */
  title: string;
  /** 条目正文。 */
  content: string;
  /** 主关键词。 */
  keywords: string[];
  /** 次关键词。 */
  secondaryKeywords: string[];
  /** 是否启用。 */
  isEnabled: boolean;
  /** 优先级。 */
  priority: number;
  /** 注入位置。 */
  insertionOrder: string;
  /** token 预算。 */
  tokenBudget: number | null;
  /** 是否区分大小写。 */
  caseSensitive: boolean;
  /** 扩展元数据。 */
  metadata: Record<string, unknown> | null;
};

/** 世界书 JSON 导入预览。 */
export type WorldBookImportPreview = ModuleImportPreviewBase & {
  /** 世界书说明。 */
  description: string;
  /** 关联角色 ID；无则为 null。 */
  characterId: string | null;
  /** 是否启用。 */
  isEnabled: boolean;
  /** 扫描深度。 */
  scanDepth: number;
  /** token 预算。 */
  tokenBudget: number;
  /** 扩展元数据。 */
  metadata: Record<string, unknown> | null;
  /** 条目预览列表。 */
  entries: WorldBookEntryImportPreview[];
};

/** 世界书 JSON 导入响应。 */
export type WorldBookImportResponse<TWorldBook = unknown> = {
  /** 是否已真正落库。 */
  imported: boolean;
  /** 导入预览。 */
  preview: WorldBookImportPreview;
  /** 正式导入后的世界书；预览时为 null。 */
  worldBook: TWorldBook | null;
};
