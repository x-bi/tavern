import { Injectable } from '@nestjs/common';

import type {
  AiImportMode,
  AiImportPromptSpecification,
  AiImportStrategyDefinition,
  AiImportTarget
} from './ai-import.types';

@Injectable()
export class AiImportRepairPromptFactory {
  build(params: {
    target: AiImportTarget;
    mode: AiImportMode;
    specification: AiImportPromptSpecification;
    strategies: AiImportStrategyDefinition[];
    customInstructions: string;
    sourceText: string;
    previousOutput: string;
    errors: Array<{ code: string; message: string }>;
  }): Array<{ role: 'system' | 'user'; content: string }> {
    return [
      {
        role: 'system',
        content: [
          '你是 Tavern Lite AI 智能导入结果修复器。',
          '只修复导致确定性校验失败的结构和字段，保留正确事实和内容。',
          '只使用当前模板字段，不生成旧版、别名、未知字段或资源 ID。',
          '返回完整 JSON 信封，不输出 Markdown、解释前缀或思维链。',
          `<target>${params.target}</target>`,
          `<mode>${params.mode}</mode>`,
          `<template>${JSON.stringify(params.specification.template)}</template>`,
          `<constraints>${JSON.stringify(params.specification.constraints)}</constraints>`,
          `<strategies>${params.strategies.map((item) => item.promptRule).join('\n')}</strategies>`
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `<validation_errors>${JSON.stringify(params.errors)}</validation_errors>`,
          `<previous_output>${params.previousOutput}</previous_output>`,
          `<custom_instructions>${params.customInstructions || '无'}</custom_instructions>`,
          `<untrusted_source>${params.sourceText}</untrusted_source>`
        ].join('\n')
      }
    ];
  }
}
