import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./characters', () => ({ importCharacterJson: vi.fn() }));
vi.mock('./personas', () => ({ importPersonaJson: vi.fn() }));
vi.mock('./presets', () => ({ importPromptPresetJson: vi.fn() }));
vi.mock('./worldBooks', () => ({ importWorldBookJson: vi.fn() }));
vi.mock('./companions', () => ({ importCompanionJson: vi.fn() }));

import { importCharacterJson } from './characters';
import { importCompanionJson } from './companions';
import { commitAiImport } from './aiImports';
import { importPersonaJson } from './personas';
import { importPromptPresetJson } from './presets';
import { importWorldBookJson } from './worldBooks';

describe('AI import final commit routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['character', importCharacterJson],
    ['persona', importPersonaJson],
    ['prompt_preset', importPromptPresetJson],
    ['world_book', importWorldBookJson],
    ['companion', importCompanionJson]
  ] as const)('reuses the %s module import API', async (target, expected) => {
    vi.mocked(expected).mockResolvedValue({} as never);
    await commitAiImport(target, '{"name":"AI result"}', 'rename');
    expect(expected).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(expected).mock.calls[0])).toContain('"commit":true');
    expect(JSON.stringify(vi.mocked(expected).mock.calls[0])).toContain(
      '"duplicateNameStrategy":"rename"'
    );
  });
});
