import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { CurrentUser } from '../../src/modules/users/user.types';
import type { ChatService } from '../../src/modules/chat/chat.service';
import type { CompanionChatService } from '../../src/modules/companion-chat/companion-chat.service';
import { QqBridgeService } from '../../src/modules/qq-bridge/qq-bridge.service';
import { InternalChatResponse } from '../../src/modules/qq-bridge/qq-bridge.types';
import type { QqNapcatClient } from '../../src/modules/qq-bridge/qq-napcat.client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { TargetEventsService } from '../../src/services/target-events/target-events.service';
import { TestDatabase } from '../helpers/test-database';

describe('QQ bridge message flow', () => {
  it('automatically creates the logged-in QQ account once and returns it to the admin', async () => {
    const database = await TestDatabase.create();
    const targetEvents = new TargetEventsService();
    const fixture = await createConversationFixture(database.client);
    const napcat = {
      getLoginInfo: vi.fn(async () => ({ qqUin: '90001', nickname: '自动接入小号' }))
    } as unknown as QqNapcatClient;
    const service = createService(database.client, targetEvents, napcat, {
      streamInternal: vi.fn()
    } as unknown as ChatService);

    try {
      const first = await service.getAutoLoginStatus(fixture.owner);
      const second = await service.getAutoLoginStatus(fixture.owner);

      expect(first).toMatchObject({
        state: 'online',
        account: { qqUin: '90001', nickname: '自动接入小号', status: 'online' }
      });
      expect(second.account?.id).toBe(first.account?.id);
      expect(await database.client.qqAccount.count()).toBe(1);
    } finally {
      service.onModuleDestroy();
      await database.close();
    }
  });

  it('logs out the active QQ, clears only its persisted login data and retains the account', async () => {
    const database = await TestDatabase.create();
    const targetEvents = new TargetEventsService();
    const fixture = await createConversationFixture(database.client);
    const loginDataPath = await mkdtemp(join(tmpdir(), 'tavern-qq-login-'));
    await writeFile(join(loginDataPath, 'quick-login.json'), '{}');
    const napcat = {
      getLoginInfo: vi.fn(async () => ({ qqUin: '90001', nickname: '切换前小号' })),
      exitBot: vi.fn(async () => undefined)
    } as unknown as QqNapcatClient;
    const service = createService(
      database.client,
      targetEvents,
      napcat,
      { streamInternal: vi.fn() } as unknown as ChatService,
      { QQ_LOGIN_DATA_PATH: loginDataPath }
    );

    try {
      const account = (await service.getAutoLoginStatus(fixture.owner)).account!;
      const binding = await service.createBinding(fixture.owner, {
        qqAccountId: account.id,
        peerQqUin: '10001',
        peerNickname: '保留绑定好友',
        targetType: 'conversation',
        targetId: fixture.conversationA.id
      });
      const result = await service.logoutAccount(fixture.owner, account.id);

      expect(result).toMatchObject({ accountId: account.id, qqUin: '90001' });
      expect(napcat.exitBot).toHaveBeenCalledWith('http://napcat:3000', null);
      expect(await readdir(loginDataPath)).toEqual([]);
      expect(
        await database.client.qqAccount.findUniqueOrThrow({ where: { id: account.id } })
      ).toMatchObject({ status: 'offline', isEnabled: false });
      expect(
        await database.client.qqChatBinding.findUniqueOrThrow({ where: { id: binding.id } })
      ).toMatchObject({ isEnabled: true, qqAccountId: account.id });
      expect(await service.getAutoLoginStatus(fixture.owner)).toMatchObject({
        state: 'waiting',
        account: null
      });
    } finally {
      service.onModuleDestroy();
      await database.close();
      await rm(loginDataPath, { recursive: true, force: true });
    }
  });

  it('routes an inbound friend message to the bound thread and sends the generated reply', async () => {
    const database = await TestDatabase.create();
    const targetEvents = new TargetEventsService();
    const sentTexts: string[] = [];
    const fixture = await createConversationFixture(database.client);
    const napcat = {
      getLoginInfo: vi.fn(async () => ({ qqUin: '90001', nickname: 'QQ 小号' })),
      sendPrivateMessage: vi.fn(async (_url, _token, _peer, text: string) => {
        sentTexts.push(text);
        return `qq-message-${sentTexts.length}`;
      })
    } as unknown as QqNapcatClient;
    const chat = {
      streamInternal: vi.fn(
        async (input: { conversationId: string; response: InternalChatResponse }) => {
          const assistant = await database.client.message.create({
            data: {
              conversationId: input.conversationId,
              role: 'assistant',
              status: 'complete',
              content: '来自同一系统会话的回复'
            }
          });
          targetEvents.emit('conversation', input.conversationId, 'generation_done', {
            messageId: assistant.id
          });
          input.response.end();
        }
      )
    } as unknown as ChatService;
    const service = createService(database.client, targetEvents, napcat, chat);

    try {
      await service.onModuleInit();
      const loginStatus = await service.getAutoLoginStatus(fixture.owner);
      const account = loginStatus.account!;
      await service.createBinding(fixture.owner, {
        qqAccountId: account.id,
        peerQqUin: '10001',
        peerNickname: '好友 A',
        targetType: 'conversation',
        targetId: fixture.conversationA.id
      });

      const accepted = await service.acceptAutoWebhook({
        post_type: 'message',
        message_type: 'private',
        sub_type: 'friend',
        self_id: '90001',
        user_id: '10001',
        message_id: 'inbound-1',
        message: [{ type: 'text', data: { text: '你好' } }]
      });

      expect(accepted).toMatchObject({ accepted: true });
      await vi.waitFor(async () => {
        expect(await database.client.qqInboundEvent.findFirst()).toMatchObject({
          status: 'completed',
          content: null
        });
        expect(await database.client.qqDelivery.findFirst()).toMatchObject({ status: 'sent' });
      });
      expect(chat.streamInternal).toHaveBeenCalledOnce();
      expect(sentTexts).toEqual(['来自同一系统会话的回复']);
    } finally {
      service.onModuleDestroy();
      await database.close();
    }
  });

  it('cancels a persisted old-target delivery after the friend switches conversations', async () => {
    const database = await TestDatabase.create();
    const targetEvents = new TargetEventsService();
    const sendPrivateMessage = vi.fn(async () => 'unexpected');
    const napcat = { sendPrivateMessage } as unknown as QqNapcatClient;
    const chat = { streamInternal: vi.fn() } as unknown as ChatService;
    const fixture = await createConversationFixture(database.client);
    const service = createService(database.client, targetEvents, napcat, chat);

    try {
      const account = await service.createAccount(fixture.owner, {
        label: 'QQ 小号',
        apiBaseUrl: 'http://napcat:3000'
      });
      const binding = await service.createBinding(fixture.owner, {
        qqAccountId: account.id,
        peerQqUin: '10001',
        targetType: 'conversation',
        targetId: fixture.conversationA.id
      });
      const oldMessage = await database.client.message.create({
        data: {
          conversationId: fixture.conversationA.id,
          role: 'assistant',
          status: 'complete',
          content: '旧会话延迟回复'
        }
      });
      const delivery = await database.client.qqDelivery.create({
        data: {
          bindingId: binding.id,
          sourceMessageKey: `conversation:${oldMessage.id}`,
          targetType: 'conversation',
          messageId: oldMessage.id,
          status: 'failed'
        }
      });
      await service.switchBinding(fixture.owner, binding.id, {
        targetType: 'conversation',
        targetId: fixture.conversationB.id
      });

      await (service as unknown as { processDelivery(id: string): Promise<void> }).processDelivery(
        delivery.id
      );

      expect(
        await database.client.qqDelivery.findUnique({ where: { id: delivery.id } })
      ).toMatchObject({
        status: 'cancelled',
        errorCode: 'QQ_BINDING_CHANGED'
      });
      expect(sendPrivateMessage).not.toHaveBeenCalled();
    } finally {
      service.onModuleDestroy();
      await database.close();
    }
  });
});

function createService(
  prisma: PrismaClient,
  targetEvents: TargetEventsService,
  napcat: QqNapcatClient,
  chat: ChatService,
  configOverrides: Record<string, string> = {}
): QqBridgeService {
  return new QqBridgeService(
    prisma as unknown as PrismaService,
    new ConfigService({
      AUTH_TOKEN_SECRET: 'qq-bridge-test-secret',
      QQ_EVENT_CALLBACK_BASE_URL: 'http://server:3100/api',
      QQ_AUTO_NAPCAT_API_BASE_URL: 'http://napcat:3000',
      QQ_LOGIN_QR_PATH: 'missing-qq-login-qr.png',
      QQ_LOGIN_DATA_PATH: 'missing-qq-login-data',
      ...configOverrides
    }),
    napcat,
    chat,
    { streamInternal: vi.fn() } as unknown as CompanionChatService,
    targetEvents
  );
}

async function createConversationFixture(prisma: PrismaClient) {
  const user = await prisma.user.create({
    data: { username: 'qq-flow-test', displayName: 'QQ Flow Test', role: 'admin' }
  });
  const character = await prisma.character.create({
    data: { userId: user.id, name: 'Character' }
  });
  const [conversationA, conversationB] = await Promise.all([
    prisma.conversation.create({
      data: { userId: user.id, characterId: character.id, title: 'Conversation A' }
    }),
    prisma.conversation.create({
      data: { userId: user.id, characterId: character.id, title: 'Conversation B' }
    })
  ]);
  const owner: CurrentUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: 'admin'
  };
  return { owner, conversationA, conversationB };
}
