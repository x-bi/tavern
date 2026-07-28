import { describe, expect, it } from 'vitest';

import source from './AiImportView.vue?raw';

describe('AiImportView contract', () => {
  it('renders the external model privacy notice and three result tabs', () => {
    expect(source).toContain('原始内容会发送到当前模型链配置的外部模型服务');
    expect(source).toContain('内容预览');
    expect(source).toContain('AI 判断说明');
    expect(source).toContain('JSON');
  });

  it('requires model/source and deterministic revalidation before commit', () => {
    expect(source).toContain('modelFallbackGroupId.value && sourceText.value.trim()');
    expect(source).toContain('validateAiImportJson');
    expect(source).toContain(':disabled="!result.valid || jsonDirty"');
  });

  it('uses the file endpoint until selected file content is edited', () => {
    expect(source).toContain('selectedFile.value && !sourceEdited.value');
    expect(source).toContain('transformAiImportFile');
    expect(source).toContain('transformAiImport(');
    expect(source).toContain('{ ...base, sourceText: sourceText.value }');
  });
});
