import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CompanionChatService } from '../../src/modules/companion-chat/companion-chat.service';
import { CompanionsService } from '../../src/modules/companions/companions.service';
import { TestDatabase } from '../helpers/test-database';

describe('Companion prompt preview memory revision', () => {
  it('returns editable runtime state through the Companion response contract', async () => {
    const database = await TestDatabase.create();
    try {
      const user = await database.client.user.create({
        data: { username: 'runtime-response', displayName: 'Owner' }
      });
      const currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin' as const
      };
      const companion = await database.client.companion.create({
        data: {
          userId: user.id,
          name: 'Companion',
          memory: { create: {} },
          runtimeState: { create: {} }
        }
      });
      const service = new CompanionsService(
        database.client as unknown as PrismaService,
        {} as never,
        { getOwner: async () => currentUser } as never,
        { shouldShowSensitiveContent: async () => true } as never
      );

      await service.updateRuntimeState(currentUser, companion.id, {
        currentMood: 'calm',
        currentSituation: 'at home'
      });
      const response = await service.getById(currentUser, companion.id);

      expect(response.runtimeState).toMatchObject({
        currentMood: 'calm',
        currentSituation: 'at home',
        version: 1
      });
    } finally {
      await database.close();
    }
  });

  it('reports the active revision instead of the numerically latest revision', async () => {
    const database = await TestDatabase.create();
    try {
      const user = await database.client.user.create({
        data: { username: 'active-memory-preview', displayName: 'Owner' }
      });
      const companion = await database.client.companion.create({
        data: {
          userId: user.id,
          name: 'Companion',
          memory: { create: { isEnabled: true } },
          runtimeState: { create: {} }
        }
      });
      const active = await database.client.companionMemoryRevision.create({
        data: {
          companionId: companion.id,
          version: 1,
          dataJson: JSON.stringify({
            claims: [],
            relationshipSummary: { content: 'active', sourceClaimIds: [] },
            currentArc: { content: '', sourceClaimIds: [] }
          }),
          reason: 'test'
        }
      });
      await database.client.companionMemoryRevision.create({
        data: {
          companionId: companion.id,
          version: 2,
          dataJson: JSON.stringify({
            claims: [],
            relationshipSummary: { content: 'newer but inactive', sourceClaimIds: [] },
            currentArc: { content: '', sourceClaimIds: [] }
          }),
          reason: 'test'
        }
      });
      await database.client.companionMemory.update({
        where: { companionId: companion.id },
        data: { activeRevisionId: active.id }
      });

      const service = new CompanionChatService(
        database.client as unknown as PrismaService,
        { getGatewayCandidates: async () => [] } as never,
        {} as never,
        {} as never,
        { shouldShowSensitiveContent: async () => true } as never,
        {} as never,
        {} as never,
        { listPromptContexts: async () => [] } as never,
        {
          evaluateCompanion: async () => ({ sections: [], decisions: [] })
        } as never,
        { listPromptMessages: async () => [] } as never,
        { validate: () => [] } as never
      );
      const preview = await service.preview(
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: 'admin'
        },
        companion.id,
        'hello'
      );

      expect(preview.memoryVersion).toBe(1);
      expect(preview.messages.map((message) => message.content).join('\n')).toContain('active');
      expect(preview.messages.map((message) => message.content).join('\n')).not.toContain(
        'newer but inactive'
      );
    } finally {
      await database.close();
    }
  });
});
