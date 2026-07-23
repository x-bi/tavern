import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ContentLibraryService } from '../../src/modules/content-library/content-library.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { WorldBooksService } from '../../src/modules/world-books/world-books.service';
import { TestDatabase } from '../helpers/test-database';
import { canonicalSha256 } from '../../src/common/canonical-json';

describe('WorldBook V2 module import/export', () => {
  it('preserves V2 activation configuration while downgrading imported trust', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new WorldBooksService(
        database.client as unknown as PrismaService,
        { assertCanSetShared: async () => undefined } as unknown as ContentLibraryService,
        { shouldShowSensitiveContent: async () => true } as SettingsService
      );
      const user = await database.client.user.create({
        data: { username: 'world-book-v2', displayName: 'Owner', role: 'admin' }
      });
      const currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin'
      } as const;
      const imported = await service.importJson(currentUser, {
        commit: true,
        duplicateNameStrategy: 'reject',
        rawJson: JSON.stringify({
          formatVersion: 'tavern-lite.world-book.v2',
          name: 'V2 exportable',
          entries: [
            {
              title: 'Rule from import',
              content: 'Imported content',
              compactContent: 'Compact',
              contentType: 'behavior_rule',
              activationMode: 'keyword',
              matchMode: 'contains',
              keywords: ['Exact'],
              primaryLogic: 'all',
              secondaryKeywords: ['Secondary'],
              secondaryLogic: 'and_all',
              excludeKeywords: ['Blocked'],
              sameMessageOnly: false,
              scanSources: ['current_user'],
              userHistoryScanDepth: 3,
              stickyTurns: 2,
              continuationTurns: 4,
              cooldownTurns: 5,
              delayTurns: 1,
              cooldownPolicy: 'current_user_override',
              generationPurposes: ['chat_reply'],
              budgetPriority: 8,
              sortOrder: 9,
              insertionOrder: 'before_current_user_input'
            }
          ]
        })
      });
      const entry = await database.client.worldBookEntry.findFirstOrThrow({
        include: { activeRevision: true }
      });
      expect(JSON.parse(entry.activeRevision!.configJson)).toMatchObject({
        contentType: 'lore',
        trustLevel: 'imported_untrusted',
        matchMode: 'contains',
        sameMessageOnly: false,
        stickyTurns: 2,
        continuationTurns: 4,
        cooldownTurns: 5,
        delayTurns: 1,
        budgetPriority: 8,
        sortOrder: 9
      });
      expect(entry.activeRevision?.compactContent).toBe('Compact');
      expect(entry.activeRevision?.compactSourceHash).toBe(canonicalSha256('Imported content'));
      expect(imported.worldBook!.entries[0]).toMatchObject({
        primaryLogic: 'all',
        secondaryLogic: 'and_all',
        excludeKeywords: ['Blocked'],
        scanSources: ['current_user'],
        generationPurposes: ['chat_reply'],
        compactContent: 'Compact',
        budgetPriority: 8,
        sortOrder: 9
      });
      expect('priority' in imported.worldBook!.entries[0]).toBe(false);
      const changed = await service.updateEntry(currentUser, entry.id, {
        content: 'Changed canonical content'
      });
      expect(changed.compactStale).toBe(true);
      const exported = await service.exportJson(currentUser, imported.worldBook!.id);
      expect(exported.card.entries[0]).toMatchObject({
        contentType: 'lore',
        trustLevel: 'imported_untrusted',
        activationMode: 'keyword',
        matchMode: 'contains',
        sameMessageOnly: false,
        budgetPriority: 8,
        sortOrder: 9
      });
    } finally {
      await database.close();
    }
  });

  it('creates, updates and resolves all four WorldBook binding target types', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new WorldBooksService(
        database.client as unknown as PrismaService,
        { assertCanSetShared: async () => undefined } as unknown as ContentLibraryService,
        { shouldShowSensitiveContent: async () => true } as SettingsService
      );
      const user = await database.client.user.create({
        data: { username: 'world-binding-v2', displayName: 'Owner', role: 'admin' }
      });
      const currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin'
      } as const;
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const persona = await database.client.userPersona.create({
        data: { userId: user.id, name: 'Persona' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, personaId: persona.id, title: 'Thread' }
      });
      const companion = await database.client.companion.create({
        data: { userId: user.id, personaId: persona.id, name: 'Companion' }
      });
      const created = await service.create(currentUser, {
        name: 'Scoped lore',
        characterIds: [character.id],
        personaIds: [persona.id],
        conversationIds: [conversation.id],
        companionIds: [companion.id]
      });
      expect(created).toMatchObject({
        characterIds: [character.id],
        personaIds: [persona.id],
        conversationIds: [conversation.id],
        companionIds: [companion.id]
      });
      expect(
        await service.listPromptContexts(currentUser, character.id, {
          personaId: persona.id,
          conversationId: conversation.id
        })
      ).toHaveLength(1);
      expect(
        await service.listPromptContexts(currentUser, null, {
          personaId: persona.id,
          companionId: companion.id
        })
      ).toHaveLength(1);
      const updated = await service.update(currentUser, created.id, {
        characterIds: [],
        personaIds: [],
        conversationIds: [],
        companionIds: []
      });
      expect(updated).toMatchObject({
        characterIds: [],
        personaIds: [],
        conversationIds: [],
        companionIds: []
      });
    } finally {
      await database.close();
    }
  });

  it('treats repeated manual operationId as a no-op for state and target versions', async () => {
    const database = await TestDatabase.create();
    try {
      const service = new WorldBooksService(
        database.client as unknown as PrismaService,
        {} as ContentLibraryService,
        { shouldShowSensitiveContent: async () => true } as SettingsService
      );
      const user = await database.client.user.create({
        data: { username: 'manual-v2', displayName: 'Owner', role: 'admin' }
      });
      const currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin'
      } as const;
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const book = await database.client.worldBook.create({
        data: { userId: user.id, name: 'Manual book' }
      });
      const entry = await service.createEntry(currentUser, book.id, {
        title: 'Manual entry',
        content: 'Manual content',
        keywords: ['manual'],
        activationMode: 'manual'
      });
      const payload = {
        operationId: 'same-operation',
        targetType: 'conversation' as const,
        targetId: conversation.id,
        active: true
      };
      const first = await service.setManualActivation(currentUser, entry.id, payload);
      const second = await service.setManualActivation(currentUser, entry.id, payload);
      const [updatedConversation, events] = await Promise.all([
        database.client.conversation.findUniqueOrThrow({ where: { id: conversation.id } }),
        database.client.conversationWorldBookActivationEvent.count({
          where: { conversationId: conversation.id }
        })
      ]);
      expect(second).toEqual(first);
      expect(first.stateVersion).toBe(1);
      expect(updatedConversation.version).toBe(1);
      expect(events).toBe(1);
    } finally {
      await database.close();
    }
  });
});
