import type { CharacterImportExampleMessage } from './character-import';
import { CHARACTER_CARD_SPEC, CHARACTER_CARD_SPEC_VERSION } from './character-import';

/**
 * 角色卡导出数据体，对齐 SillyTavern Character Card V2 的 `data` 字段。
 *
 * 其中 `first_mes` / `mes_example` 是 chara_card_v2 规范字段，不属于项目旧字段兼容。
 */
export type CharacterExportCardData = {
  /** 角色名。 */
  name: string;
  coreIdentity: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  persistentPremise: string;
  initialScenario: string;
  extendedBackground: string;
  characterRules: string;
  speechStyle: string;
  /** 场景设定。 */
  scenario: string;
  /** 角色首条消息（对话开场白）。 */
  first_mes: string;
  /** 对话示例。 */
  mes_example: string;
  /** 创作者备注。 */
  creator_notes?: string;
  /** 自定义系统 Prompt。 */
  system_prompt?: string;
  /** 标签列表。 */
  tags?: string[];
  /** 创作者名。 */
  creator?: string;
  /** 角色卡版本。 */
  character_version?: string;
  /** 备选开场白列表。 */
  alternate_greetings?: string[];
  /** 扩展字段，承载规范之外的自定义数据。 */
  extensions?: Record<string, unknown>;
  /** 角色深度提示配置（chara_card_v2 标准扩展字段）。 */
  depth_prompt?: unknown;
  /** 历史消息后的附加指令。 */
  post_history_instructions?: string;
};

/**
 * 完整的角色卡导出结构（含规范标识），即 `chara_card_v2` 2.0。
 */
export type CharacterExportCard = {
  /** 角色卡规范标识，固定为 `chara_card_v2`。 */
  spec: typeof CHARACTER_CARD_SPEC;
  /** 规范版本，固定为 `2.0`。 */
  spec_version: typeof CHARACTER_CARD_SPEC_VERSION;
  /** 角色卡数据体。 */
  data: CharacterExportCardData;
};

/** 角色导出接口的响应体。 */
export type CharacterExportResponse = {
  /** 建议下载使用的文件名。 */
  fileName: string;
  /** 角色卡结构。 */
  card: CharacterExportCard;
  /** 导出时间（ISO 字符串）。 */
  exportedAt: string;
  /** 规范化后的对话示例列表（从 mes_example 解析而来）。 */
  exampleMessages: CharacterImportExampleMessage[];
};
