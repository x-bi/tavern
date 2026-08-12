import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TestDatabase } from '../helpers/test-database';

describe('QQ binding database constraints', () => {
  it('enforces one friend to one target and one target to one friend', async () => {
    const database = await TestDatabase.create();
    try {
      const prisma = database.client;
      const user = await prisma.user.create({
        data: { username: 'qq-test', displayName: 'QQ Test' }
      });
      const character = await prisma.character.create({
        data: { userId: user.id, name: 'Character' }
      });
      const conversationA = await prisma.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'A' }
      });
      const conversationB = await prisma.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'B' }
      });
      const account = await prisma.qqAccount.create({
        data: { userId: user.id, label: 'QQ', apiBaseUrl: 'http://napcat:3000' }
      });
      await prisma.qqChatBinding.create({
        data: {
          userId: user.id,
          qqAccountId: account.id,
          peerQqUin: '10001',
          targetType: 'conversation',
          conversationId: conversationA.id
        }
      });
      await expect(
        prisma.qqChatBinding.create({
          data: {
            userId: user.id,
            qqAccountId: account.id,
            peerQqUin: '10001',
            targetType: 'conversation',
            conversationId: conversationB.id
          }
        })
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.qqChatBinding.create({
          data: {
            userId: user.id,
            qqAccountId: account.id,
            peerQqUin: '10002',
            targetType: 'conversation',
            conversationId: conversationA.id
          }
        })
      ).rejects.toMatchObject({ code: 'P2002' });
    } finally {
      await database.close();
    }
  });

  it('migration includes target shape checks', () => {
    const sql = readFileSync(
      resolve('prisma/migrations/20260812120000_add_qq_personal_account_bridge/migration.sql'),
      'utf8'
    );
    expect(sql).toContain('QqChatBinding_conversationId_key');
    expect(sql).toContain('QqChatBinding_companionId_key');
    expect(sql).toContain('QqChatBinding_target_check');
  });
});
