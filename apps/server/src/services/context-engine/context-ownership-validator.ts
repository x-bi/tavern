import { Injectable } from '@nestjs/common';

export type ContextOwnershipIssue = {
  code: 'CONTEXT_DUPLICATE' | 'CONTEXT_OWNERSHIP_CONFLICT';
  fields: string[];
  message: string;
};

/** Advisory validator: reports misplaced/duplicated content and never mutates user-authored text. */
@Injectable()
export class ContextOwnershipValidator {
  validate(input: Record<string, string | null | undefined>): ContextOwnershipIssue[] {
    const normalized = Object.entries(input)
      .map(([field, value]) => [field, normalize(value ?? '')] as const)
      .filter(([, value]) => value.length >= 8);
    const issues: ContextOwnershipIssue[] = [];
    for (let left = 0; left < normalized.length; left += 1) {
      for (let right = left + 1; right < normalized.length; right += 1) {
        const [leftField, leftText] = normalized[left];
        const [rightField, rightText] = normalized[right];
        if (
          leftText === rightText ||
          leftText.includes(rightText) ||
          rightText.includes(leftText)
        ) {
          issues.push({
            code: 'CONTEXT_DUPLICATE',
            fields: [leftField, rightField],
            message: `${leftField} and ${rightField} contain duplicated context.`
          });
        }
      }
    }
    const ownership = [
      ['persona.coreIdentity', /你是(?:一个)?\s*(?:ai|助手|角色)/i],
      ['persona.background', /必须回复|输出格式|禁止回答/i],
      ['memory', /系统提示|不可覆盖规则|api\s*key/i]
    ] as const;
    ownership.forEach(([field, pattern]) => {
      const value = input[field];
      if (value && pattern.test(value)) {
        issues.push({
          code: 'CONTEXT_OWNERSHIP_CONFLICT',
          fields: [field],
          message: `${field} appears to contain content owned by another context module.`
        });
      }
    });
    return issues;
  }
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('und').replace(/\s+/g, ' ').trim();
}
