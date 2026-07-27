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
                    stickyTurns: 2,
                    placement: 'before_current_user',
                    maxTokens: 222
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
        stickyTurns: 2,
        placement: 'before_current_user',
        maxTokens: 222
      });
    } finally {
      await database.close();
    }
  });

  it('rejects legacy world-book entry fields inside content packs', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-legacy', displayName: 'Owner' }
      });
      await expect(
        service.importContentPack(
          { id: user.id, username: user.username, displayName: user.displayName, role: 'admin' },
          {
            commit: false,
            duplicateStrategy: 'reject',
            rawJson: JSON.stringify({
              format: 'tavern-lite.content-pack.v2',
              title: 'Legacy pack',
              worldBooks: [
                {
                  ref: 'book',
                  name: 'Legacy lore',
                  entries: [
                    {
                      title: 'Legacy',
                      content: 'Legacy content',
                      keywords: ['legacy'],
                      insertionOrder: 'before_current_user_input'
                    }
                  ]
                }
              ]
            })
          }
        )
      ).rejects.toThrow(/insertionOrder is not supported/);
    } finally {
      await database.close();
    }
  });

  it('rejects content-pack presets with V1 fields or snake_case params', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-preset-legacy', displayName: 'Owner' }
      });
      const ctx = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin' as const
      };

      await expect(
        service.importContentPack(ctx, {
          commit: false,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'V1 preset fields',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Legacy',
                systemPrompt: 'legacy',
                outputRules: 'legacy',
                instructions: [],
                outputRuleOperations: [],
                generationPurposes: []
              }
            ]
          })
        })
      ).rejects.toThrow(/systemPrompt is not supported by the V2 format/);

      await expect(
        service.importContentPack(ctx, {
          commit: false,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'Bad operation',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Bad op',
                instructions: [],
                outputRuleOperations: [
                  { key: 'style', content: 'x', operation: 'replace', sortOrder: 0 }
                ],
                generationPurposes: ['chat_reply']
              }
            ]
          })
        })
      ).rejects.toThrow(/operation must be one of/);

      await expect(
        service.importContentPack(ctx, {
          commit: false,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'Snake params',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Snake',
                instructions: [],
                outputRuleOperations: [],
                generationPurposes: ['chat_reply'],
                parameters: { top_p: 0.5 }
              }
            ]
          })
        })
      ).rejects.toThrow(/top_p is not supported/);

      await expect(
        service.importContentPack(ctx, {
          commit: false,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'Bad instructions',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Bad instructions',
                instructions: ['ok', 123],
                outputRuleOperations: [],
                generationPurposes: ['chat_reply']
              }
            ]
          })
        })
      ).rejects.toThrow(/instructions\[1\] must be a string/);
    } finally {
      await database.close();
    }
  });

  it('preserves an explicit empty generationPurposes array in a content-pack preset', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-empty-purposes', displayName: 'Owner' }
      });
      await service.importContentPack(
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: 'admin'
        },
        {
          commit: true,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'Empty purposes',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Disabled everywhere',
                instructions: [],
                outputRuleOperations: [],
                generationPurposes: []
              }
            ]
          })
        }
      );

      const preset = await database.client.promptPreset.findFirstOrThrow({
        where: { userId: user.id }
      });
      expect(JSON.parse(preset.generationPurposesJson)).toEqual([]);
    } finally {
      await database.close();
    }
  });

  it('rejects V1 profile fields anywhere inside a V2 content pack', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-profile-v1', displayName: 'Owner' }
      });
      const currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin' as const
      };
      const cases = [
        {
          characters: [{ ref: 'c', name: 'Legacy character', description: 'legacy' }]
        },
        {
          personas: [{ ref: 'p', name: 'Legacy persona', content: 'legacy' }]
        }
      ];

      for (const fields of cases) {
        await expect(
          service.importContentPack(currentUser, {
            commit: false,
            duplicateStrategy: 'reject',
            rawJson: JSON.stringify({
              format: 'tavern-lite.content-pack.v2',
              title: 'Legacy profile',
              ...fields
            })
          })
        ).rejects.toThrow(/is not supported by the V2 format/);
      }
    } finally {
      await database.close();
    }
  });

  it('imports content-pack preset parameters with all six fields', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new ContentPacksService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'pack-preset-params', displayName: 'Owner' }
      });
      const result = await service.importContentPack(
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: 'admin'
        },
        {
          commit: true,
          duplicateStrategy: 'reject',
          rawJson: JSON.stringify({
            format: 'tavern-lite.content-pack.v2',
            title: 'Full params',
            promptPresets: [
              {
                ref: 'preset',
                name: 'Full params',
                instructions: ['Atomic'],
                outputRuleOperations: [
                  { key: 'style', content: 'Natural', operation: 'add', sortOrder: 1 }
                ],
                generationPurposes: ['chat_reply'],
                parameters: {
                  temperature: 0.8,
                  topP: 0.9,
                  maxTokens: 1200,
                  timeout: 30000,
                  frequencyPenalty: 0.1,
                  presencePenalty: 0.2
                }
              }
            ]
          })
        }
      );
      expect(result.imported).toBe(true);
      const preset = await database.client.promptPreset.findFirstOrThrow({
        where: { userId: user.id }
      });
      expect(JSON.parse(preset.parametersJson!)).toEqual({
        temperature: 0.8,
        topP: 0.9,
        maxTokens: 1200,
        timeout: 30000,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2
      });
    } finally {
      await database.close();
    }
  });
});
