import { describe, expect, it, vi } from 'vitest';

import { AiImportTargetRegistry } from '../../src/modules/ai-imports/ai-import-target.registry';

const user = { id: 'u1', username: 'u', displayName: 'U', role: 'member' as const };

function service(formatVersion: string) {
  return {
    getImportTemplate: () => ({ template: { formatVersion, name: 'template' } }),
    getImportSpecification: () => ({
      targetDescription: formatVersion,
      template: { formatVersion, name: 'template' },
      constraints: { current: true }
    }),
    importJson: vi.fn().mockResolvedValue({
      imported: false,
      preview: { name: 'preview', warnings: [] }
    })
  };
}

describe('AiImportTargetRegistry', () => {
  it('forwards templates, specifications and commit=false previews for all five targets', async () => {
    const character = service('chara_card_v2/2.0');
    const persona = service('tavern-lite.persona.v2');
    const preset = service('tavern-lite.prompt-preset.v2');
    const worldBook = service('tavern-lite.world-book.v2');
    const companion = service('tavern-lite.companion.v2');
    const registry = new AiImportTargetRegistry(
      character as never,
      persona as never,
      preset as never,
      worldBook as never,
      companion as never
    );

    for (const target of [
      'character',
      'persona',
      'prompt_preset',
      'world_book',
      'companion'
    ] as const) {
      const adapter = registry.get(target);
      expect(adapter.getImportSpecification().constraints).toEqual({ current: true });
      await expect(adapter.previewImport(user, '{"name":"preview"}')).resolves.toMatchObject({
        name: 'preview'
      });
    }
    for (const item of [character, persona, preset, worldBook, companion]) {
      expect(item.importJson).toHaveBeenCalledWith(user, {
        rawJson: '{"name":"preview"}',
        commit: false
      });
    }
  });
});
