import { BadRequestException } from '@nestjs/common';
import type { Character } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { CharacterCardJsonExporter } from '../../src/modules/characters/export/character-card-json-exporter';
import { CharacterCardJsonImporter } from '../../src/modules/characters/import/character-card-json-importer';

function makeCard(data: Record<string, unknown>): string {
  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data
  });
}

describe('CharacterCardJsonImporter V2-only contract', () => {
  it('maps exact chara_card_v2 fields and project V2 fields', () => {
    const result = new CharacterCardJsonImporter().map(
      makeCard({
        name: 'Exact V2',
        coreIdentity: 'core',
        description: 'standard description',
        personality: 'kind',
        persistentPremise: 'premise',
        initialScenario: 'scenario',
        extendedBackground: 'background',
        characterRules: 'rules',
        speechStyle: 'natural',
        first_mes: 'hello',
        mes_example: '<START>\n{{user}}: hi\nExact V2: hello',
        tags: ['v2']
      })
    );

    expect(result).toMatchObject({
      name: 'Exact V2',
      coreIdentity: 'core',
      personality: 'kind',
      persistentPremise: 'premise',
      initialScenario: 'scenario',
      characterRules: 'rules',
      speechStyle: 'natural',
      firstMessage: 'hello',
      exampleMessages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' }
      ],
      metadata: { tags: ['v2'] },
      warnings: []
    });
  });

  it('rejects root-level data fallback and old field aliases', () => {
    const importer = new CharacterCardJsonImporter();
    const invalidCards = [
      JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', name: 'Root fallback' }),
      makeCard({ char_name: 'Alias' }),
      makeCard({ name: 'Alias', firstMessage: 'legacy alias' }),
      makeCard({ name: 'Alias', systemPrompt: 'legacy alias' }),
      makeCard({ name: 'Alias', exampleMessages: [] })
    ];

    for (const rawJson of invalidCards) {
      expect(() => importer.map(rawJson)).toThrow(BadRequestException);
    }
  });

  it('rejects unknown fields instead of archiving them into metadata', () => {
    expect(() =>
      new CharacterCardJsonImporter().map(makeCard({ name: 'Unknown', surprise: true }))
    ).toThrow(/surprise is not supported/);
  });

  it('round-trips strict chara_card_v2 fields through import and export', () => {
    const importer = new CharacterCardJsonImporter();
    const imported = importer.map(
      makeCard({
        name: 'Round Trip',
        description: 'standard description',
        personality: 'kind',
        scenario: 'standard scenario',
        first_mes: 'hello',
        mes_example: '<START>\n{{user}}: hi\nRound Trip: hello',
        creator_notes: 'creator notes',
        system_prompt: 'stay in character',
        tags: ['v2', 'round-trip'],
        creator: 'tester',
        character_version: '2.1',
        alternate_greetings: ['welcome back'],
        extensions: { vendor: { enabled: true } },
        depth_prompt: { depth: 4, prompt: 'remember the scene' },
        post_history_instructions: 'continue naturally'
      })
    );
    const now = new Date('2026-07-27T00:00:00.000Z');
    const character: Character = {
      id: 'character-round-trip',
      userId: 'user-round-trip',
      avatarAssetId: null,
      name: imported.name,
      coreIdentity: imported.coreIdentity,
      personality: imported.personality,
      persistentPremise: imported.persistentPremise,
      initialScenario: imported.initialScenario,
      extendedBackground: imported.extendedBackground,
      characterRules: imported.characterRules,
      speechStyle: imported.speechStyle,
      firstMessage: imported.firstMessage,
      exampleMessagesJson: JSON.stringify(imported.exampleMessages),
      metadataJson: JSON.stringify(imported.metadata),
      isSensitive: false,
      isShared: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    const exported = new CharacterCardJsonExporter().export(
      character,
      imported.metadata,
      imported.exampleMessages
    );
    const reimported = importer.map(JSON.stringify(exported.card));

    expect(exported.card.data).toMatchObject({
      creator_notes: 'creator notes',
      system_prompt: 'stay in character',
      tags: ['v2', 'round-trip'],
      creator: 'tester',
      character_version: '2.1',
      alternate_greetings: ['welcome back'],
      depth_prompt: { depth: 4, prompt: 'remember the scene' },
      post_history_instructions: 'continue naturally',
      extensions: { vendor: { enabled: true } }
    });
    expect(reimported).toMatchObject({
      name: imported.name,
      coreIdentity: imported.coreIdentity,
      personality: imported.personality,
      persistentPremise: imported.persistentPremise,
      initialScenario: imported.initialScenario,
      characterRules: imported.characterRules,
      firstMessage: imported.firstMessage,
      exampleMessages: imported.exampleMessages,
      metadata: {
        creatorNotes: 'creator notes',
        tags: ['v2', 'round-trip'],
        creator: 'tester',
        characterVersion: '2.1',
        alternateGreetings: ['welcome back'],
        depthPrompt: { depth: 4, prompt: 'remember the scene' },
        postHistoryInstructions: 'continue naturally',
        extensions: { vendor: { enabled: true } }
      },
      warnings: []
    });
    expect(reimported.metadata).not.toHaveProperty('importedCard');
  });
});
