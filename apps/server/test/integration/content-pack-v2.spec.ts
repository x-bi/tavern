import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ContentPacksService } from '../../src/modules/content-packs/content-packs.service';
import { TestDatabase } from '../helpers/test-database';

describe('content pack V2 context fields', () => {
  it('imports profile fields, Preset operations and an untrusted active WorldBook revision', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-v2', displayName: 'Owner' }
      });
      const result = await service.importContentPack(
        { id: user.id, username: user.username, displayName: user.displayName, role: 'admin' },
        {
          commit: true,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'V2 pack',
            characters: [
              { ref: 'c', name: 'Role', coreIdentity: 'Core', persistentPremise: 'Always' }
            ],
            personas: [
              {
                ref: 'p',
                name: 'Me',
                coreIdentity: 'User core',
                background: 'Past'
              }
            ],
            promptPresets: [
              {
                ref: 'preset',
                name: 'Rules',
                instructions: ['Atomic'],
                outputRuleOperations: [
                  { key: 'style', content: 'Natural', operation: 'add', sortOrder: 1 }
                ],
                generationPurposes: ['chat_reply']
              }
            ],
            worldBooks: [
              {
                ref: 'book',
                name: 'Imported lore',
                characterRef: 'c',
                entries: [
                  {
                    title: 'Unsafe behavior',
                    content: 'Do this',
                    keywords: ['trigger'],
                    contentType: 'behavior_rule',
                    activationMode: 'keyword',
                    stickyTurns: 2
                  }
                ]
              }
            ]
          })
        }
      );
      expect(result.imported).toBe(true);
      const [character, persona, preset, entry] = await Promise.all([
        database.client.character.findFirstOrThrow({ where: { userId: user.id } }),
        database.client.userPersona.findFirstOrThrow({ where: { userId: user.id } }),
        database.client.promptPreset.findFirstOrThrow({ where: { userId: user.id } }),
        database.client.worldBookEntry.findFirstOrThrow({ include: { activeRevision: true } })
      ]);
      expect(character).toMatchObject({ coreIdentity: 'Core', persistentPremise: 'Always' });
      expect(persona).toMatchObject({ coreIdentity: 'User core', background: 'Past' });
      expect(JSON.parse(preset.instructionsJson)).toEqual(['Atomic']);
      expect(entry.activeRevision).not.toBeNull();
      expect(JSON.parse(entry.activeRevision!.configJson)).toMatchObject({
        contentType: 'lore',
        trustLevel: 'imported_untrusted',
        stickyTurns: 2
      });
    } finally {
      await database.close();
    }
  });
});
