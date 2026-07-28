import { BadRequestException, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { AiImportMode, AiImportStrategyDefinition, AiImportTarget } from './ai-import.types';

const ALL_TARGETS: AiImportTarget[] = [
  'character',
  'persona',
  'prompt_preset',
  'world_book',
  'companion'
];
const ALL_MODES: AiImportMode[] = ['fill_missing', 'smart_optimize', 'rebuild'];
const OPTIMIZE_MODES: AiImportMode[] = ['smart_optimize', 'rebuild'];

const general = (
  id: string,
  label: string,
  description: string,
  promptRule: string,
  order: number,
  supportedModes = ALL_MODES,
  defaultModes: AiImportMode[] = ALL_MODES
): AiImportStrategyDefinition => ({
  id,
  label,
  description,
  promptRule,
  order,
  scope: 'general',
  category: '通用',
  targets: ALL_TARGETS,
  supportedModes,
  defaultModes,
  recommended: true
});

const moduleStrategy = (
  target: AiImportTarget,
  id: string,
  label: string,
  promptRule: string,
  order: number,
  supportedModes: AiImportMode[] = ALL_MODES,
  defaultModes: AiImportMode[] = ['smart_optimize', 'rebuild']
): AiImportStrategyDefinition => ({
  id,
  label,
  description: promptRule,
  promptRule,
  order,
  scope: 'module',
  category: '模块专项',
  targets: [target],
  supportedModes,
  defaultModes,
  recommended: true
});

const DEFINITIONS: AiImportStrategyDefinition[] = [
  general(
    'preserve_source_facts',
    '保留原文事实',
    '保护明确事实',
    '不得改变原文明确的人名、关系、地点、经历与事件。',
    10
  ),
  general(
    'avoid_fabrication',
    '避免虚构',
    '信息不足时不编造',
    '无法可靠推断的信息使用默认值、留空或给出警告。',
    20
  ),
  general(
    'complete_missing_content',
    '补全缺失内容',
    '补充正常使用所需辅助字段',
    '在不改变事实的前提下补齐当前模板所需内容。',
    30
  ),
  {
    ...general(
      'optimize_existing_config',
      '优化已有配置',
      '检查语义不合理的合法参数',
      '检查并修正格式合法但与内容用途不匹配的运行配置。',
      40,
      OPTIMIZE_MODES,
      OPTIMIZE_MODES
    ),
    conflictsWith: ['lock_existing_config']
  },
  {
    ...general(
      'lock_existing_config',
      '锁定已有配置',
      '除非法值外保留已有运行配置',
      '已有合法运行配置保持不变，只修复无法导入的值。',
      45,
      ALL_MODES,
      []
    ),
    recommended: false,
    conflictsWith: ['optimize_existing_config']
  },
  general(
    'conservative_parameters',
    '保守参数',
    '避免极端和过度触发',
    '信息不足时优先使用低污染、低过度触发的保守参数。',
    50
  ),
  general(
    'preserve_source_language',
    '保持原文语言',
    '保持输入主要语言',
    '保持原始内容的主要语言，不无故混用其他语言。',
    60
  ),
  general(
    'deduplicate_content',
    '精简重复内容',
    '合并无新增信息的重复内容',
    '合并明显重复内容，但保留职责不同的相似内容。',
    70,
    OPTIMIZE_MODES,
    ['rebuild']
  ),

  moduleStrategy(
    'character',
    'complete_speaking_style',
    '补充说话方式',
    '从素材推断并完善 speechStyle。',
    110
  ),
  moduleStrategy(
    'character',
    'complete_behavior_patterns',
    '补充行为习惯',
    '将稳定行为习惯归入人格或背景，不虚构重大经历。',
    120
  ),
  moduleStrategy(
    'character',
    'generate_first_message',
    '生成第一条消息',
    '生成符合角色设定的 first_mes。',
    130
  ),
  moduleStrategy(
    'character',
    'generate_example_dialogues',
    '生成示例对话',
    '生成少量能体现说话方式的 mes_example。',
    140
  ),
  moduleStrategy(
    'character',
    'reduce_narration',
    '减少旁白',
    '降低动作和环境旁白比例，保持自然对话。',
    150
  ),
  moduleStrategy(
    'character',
    'strengthen_character_consistency',
    '增强角色一致性',
    '整理稳定身份、人格和规则，避免互相冲突。',
    160
  ),

  moduleStrategy(
    'persona',
    'highlight_user_identity',
    '突出用户身份',
    '只整理用户身份，不混入角色信息。',
    210
  ),
  moduleStrategy(
    'persona',
    'organize_user_expression_style',
    '整理表达方式',
    '整理用户表达偏好和互动边界。',
    220
  ),
  moduleStrategy(
    'persona',
    'clarify_user_relationship',
    '明确互动关系',
    '只保留素材中明确的用户与角色关系。',
    230
  ),
  moduleStrategy(
    'persona',
    'avoid_acting_for_user',
    '避免替用户行动',
    '不要把替用户决定行动的规则写入 Persona。',
    240
  ),
  moduleStrategy(
    'persona',
    'exclude_character_information',
    '排除角色信息',
    '把 AI 角色自身信息排除出 Persona。',
    250
  ),

  moduleStrategy(
    'prompt_preset',
    'strengthen_context_continuity',
    '增强上下文连续性',
    '生成跨角色可复用的上下文连续性指令。',
    310
  ),
  moduleStrategy(
    'prompt_preset',
    'reduce_repetition',
    '减少重复',
    '加入克制的防重复规则，不使用固定套话。',
    320
  ),
  moduleStrategy(
    'prompt_preset',
    'avoid_deciding_for_user',
    '不替用户决定',
    '加入不代替用户行动和发言的约束。',
    330
  ),
  moduleStrategy(
    'prompt_preset',
    'optimize_output_rules',
    '优化输出规则',
    '使用当前 outputRuleOperations 结构组织输出规则。',
    340
  ),
  moduleStrategy(
    'prompt_preset',
    'optimize_generation_parameters',
    '优化生成参数',
    '按用途使用合法且保守的 camelCase 生成参数。',
    350
  ),

  moduleStrategy(
    'world_book',
    'split_single_responsibility_entries',
    '拆分单一职责条目',
    '按人物、地点、组织、规则或事件拆成职责单一条目。',
    410
  ),
  moduleStrategy(
    'world_book',
    'generate_precise_keywords',
    '生成精准关键词',
    '为 keyword 条目生成能准确命中的主关键词。',
    420
  ),
  {
    ...moduleStrategy(
      'world_book',
      'generate_secondary_keywords',
      '生成辅助关键词',
      '需要缩小命中范围时生成 secondaryKeywords。',
      430
    ),
    requires: ['generate_precise_keywords']
  },
  moduleStrategy(
    'world_book',
    'generate_exclude_keywords',
    '生成排除词',
    '在存在明显误触语境时生成 excludeKeywords。',
    440
  ),
  moduleStrategy(
    'world_book',
    'avoid_name_only_trigger',
    '避免仅姓名触发',
    '避免把高频姓名作为唯一触发条件。',
    450
  ),
  moduleStrategy(
    'world_book',
    'avoid_over_activation',
    '避免过度激活',
    '避免全部常驻、最高优先级或过宽匹配。',
    460
  ),
  moduleStrategy(
    'world_book',
    'optimize_placement',
    '优化注入位置',
    '按内容职责选择当前合法 placement。',
    470
  ),
  moduleStrategy(
    'world_book',
    'optimize_scan_sources',
    '优化扫描来源',
    '按触发语义选择合法 scanSources 和深度。',
    480
  ),
  moduleStrategy(
    'world_book',
    'optimize_runtime_config',
    '优化运行参数',
    '合理设置粘性、延续、冷却、延迟和预算优先级。',
    490
  ),
  moduleStrategy(
    'world_book',
    'merge_similar_entries',
    '合并相似条目',
    '合并职责和事实都重复的条目。',
    500,
    OPTIMIZE_MODES
  ),

  moduleStrategy(
    'companion',
    'optimize_for_long_term_companionship',
    '适配长期陪伴',
    '生成稳定、可长期延续的核心身份和关系默认值。',
    610
  ),
  moduleStrategy(
    'companion',
    'natural_short_replies',
    '自然短回复',
    '使用自然私聊式表达，避免每次长篇回复。',
    620
  ),
  moduleStrategy('companion', 'reduce_preaching', '减少说教', '减少未经请求的说教和建议。', 630),
  moduleStrategy(
    'companion',
    'reduce_user_paraphrasing',
    '减少复述用户',
    '避免机械复述用户原话。',
    640
  ),
  moduleStrategy(
    'companion',
    'strengthen_stable_personality',
    '稳定人格',
    '保持长期一致的人格与表达方式。',
    650
  )
];

@Injectable()
export class AiImportStrategyRegistry {
  private readonly definitions = new Map(
    DEFINITIONS.map((definition) => [definition.id, definition])
  );

  getOptions(target: AiImportTarget, mode: AiImportMode) {
    return [...this.definitions.values()]
      .filter((definition) => definition.targets.includes(target))
      .sort((left, right) => left.order - right.order)
      .map((definition) => ({
        id: definition.id,
        label: definition.label,
        description: definition.description,
        scope: definition.scope,
        category: definition.category,
        supportedModes: definition.supportedModes,
        defaultEnabled: definition.defaultModes?.includes(mode) ?? false,
        recommended: definition.recommended ?? false,
        disabled: !definition.supportedModes.includes(mode),
        disabledReason: definition.supportedModes.includes(mode)
          ? null
          : '当前处理方式不支持此策略。'
      }));
  }

  resolve(
    target: AiImportTarget,
    mode: AiImportMode,
    generalIds: string[],
    moduleIds: string[]
  ): AiImportStrategyDefinition[] {
    const requested = [...new Set([...generalIds, ...moduleIds])];
    const selected = requested.map((id) => {
      const definition = this.definitions.get(id);
      if (!definition) {
        throw this.error(ERROR_CODES.AI_IMPORT_STRATEGY_UNKNOWN, `Unknown strategy: ${id}.`);
      }
      if (!definition.targets.includes(target) || !definition.supportedModes.includes(mode)) {
        throw this.error(
          ERROR_CODES.AI_IMPORT_STRATEGY_UNSUPPORTED,
          `Strategy ${id} is not supported for ${target}/${mode}.`
        );
      }
      const expectedScope = generalIds.includes(id) ? 'general' : 'module';
      if (definition.scope !== expectedScope) {
        throw this.error(
          ERROR_CODES.AI_IMPORT_STRATEGY_UNSUPPORTED,
          `Strategy ${id} was submitted in the wrong scope.`
        );
      }
      return definition;
    });
    const selectedIds = new Set(selected.map((definition) => definition.id));
    for (const definition of selected) {
      const conflict = definition.conflictsWith?.find((id) => selectedIds.has(id));
      if (conflict) {
        throw this.error(
          ERROR_CODES.AI_IMPORT_STRATEGY_CONFLICT,
          `Strategies ${definition.id} and ${conflict} conflict.`
        );
      }
      const missing = definition.requires?.find((id) => !selectedIds.has(id));
      if (missing) {
        throw this.error(
          ERROR_CODES.AI_IMPORT_STRATEGY_REQUIREMENT_MISSING,
          `Strategy ${definition.id} requires ${missing}.`
        );
      }
    }
    return selected.sort((left, right) => left.order - right.order);
  }

  private error(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }
}
