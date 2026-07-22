import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CompanionMemoryService } from '../../src/modules/companion-memory/companion-memory.service';
import { CompanionReplayService } from '../../src/services/context-engine/replay.service';
import { TestDatabase } from '../helpers/test-database';

describe('Companion memory replay concurrency', () => {
  it('does not promote a working summary after replay invalidates its base snapshot', async () => {
    const database = await TestDatabase.create();
    try {
      const prisma = database.client as unknown as PrismaService;
      const user = await database.client.user.create({
        data: { username: 'memory-replay-race', displayName: 'Owner' }
      });
      const companion = await database.client.companion.create({
        data: { userId: user.id, name: 'Companion' }
      });
      await database.client.companionMemory.create({
        data: {
          companionId: companion.id,
          isEnabled: true,
          updatedAt: new Date('2020-01-01T00:00:00.000Z')
        }
      });
      const active = await database.client.companionMemoryRevision.create({
        data: { companionId: companion.id, version: 1, reason: 'seed' }
      });
      const beforeReplay = await database.client.companionMemory.update({
        where: { companionId: companion.id },
        data: { activeRevisionId: active.id, updatedAt: new Date('2020-01-01T00:00:00.000Z') }
      });
      await new CompanionReplayService(prisma).replay(companion.id);
      const afterReplay = await database.client.companionMemory.findUniqueOrThrow({
        where: { companionId: companion.id }
      });
      expect(afterReplay.status).toBe('stale');
      expect(afterReplay.updatedAt.getTime()).not.toBe(beforeReplay.updatedAt.getTime());

      const service = new CompanionMemoryService(
        prisma,
        {} as never,
        {} as never,
        {} as never,
        {} as never
      );
      const writeRevision = (
        service as unknown as {
          writeRevision: (
            companionId: string,
            relationshipState: string,
            currentArc: string,
            cursor: string | null,
            historyFloorMessageId: string | null,
            reason: string,
            expectedMemoryUpdatedAt: Date
          ) => Promise<unknown>;
        }
      ).writeRevision.bind(service);
      await expect(
        writeRevision(
          companion.id,
          'obsolete summary',
          '',
          null,
          null,
          'automatic',
          beforeReplay.updatedAt
        )
      ).rejects.toThrow('MEMORY_CHANGED_DURING_SUMMARY');
      expect(await database.client.companionMemoryRevision.count()).toBe(1);
      expect(
        (
          await database.client.companionMemory.findUniqueOrThrow({
            where: { companionId: companion.id }
          })
        ).activeRevisionId
      ).toBe(active.id);
    } finally {
      await database.close();
    }
  });
});
