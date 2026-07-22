import { afterEach, describe, expect, it } from 'vitest';
import { TestDatabase } from '../helpers/test-database';

let database: TestDatabase | undefined;

afterEach(async () => {
  await database?.close();
  database = undefined;
});

describe('T0b logical turn schema', () => {
  it('enforces real Conversation Turn and Message foreign keys', async () => {
    database = await TestDatabase.create();
    const user = await database.client.user.create({
      data: { username: 'owner', displayName: 'Owner' }
    });
    const character = await database.client.character.create({
      data: { userId: user.id, name: 'Character' }
    });
    const conversation = await database.client.conversation.create({
      data: { userId: user.id, characterId: character.id, title: 'Conversation' }
    });
    const userMessage = await database.client.message.create({
      data: { conversationId: conversation.id, role: 'user', content: 'hello' }
    });
    const turn = await database.client.conversationTurn.create({
      data: {
        conversationId: conversation.id,
        sequence: 1,
        userMessageId: userMessage.id,
        status: 'generating'
      }
    });
    await database.client.message.update({
      where: { id: userMessage.id },
      data: { turnId: turn.id }
    });
    const assistant = await database.client.message.create({
      data: {
        conversationId: conversation.id,
        turnId: turn.id,
        role: 'assistant',
        content: 'world',
        status: 'complete'
      }
    });
    await database.client.conversationTurn.update({
      where: { id: turn.id },
      data: {
        activeAssistantMessageId: assistant.id,
        completedOrdinal: 1,
        status: 'complete'
      }
    });

    const stored = await database.client.conversationTurn.findUnique({
      where: { id: turn.id },
      include: { userMessage: true, activeAssistant: true, messages: true }
    });
    expect(stored?.userMessage.id).toBe(userMessage.id);
    expect(stored?.activeAssistant?.id).toBe(assistant.id);
    expect(stored?.messages).toHaveLength(2);
    await expect(
      database.client.conversationTurn.create({
        data: {
          conversationId: conversation.id,
          sequence: 2,
          userMessageId: userMessage.id,
          status: 'pending'
        }
      })
    ).rejects.toThrow();
  });

  it('enforces the separate Companion Turn foreign-key boundary', async () => {
    database = await TestDatabase.create();
    const user = await database.client.user.create({
      data: { username: 'owner-2', displayName: 'Owner' }
    });
    const companion = await database.client.companion.create({
      data: { userId: user.id, name: 'Companion' }
    });
    const userMessage = await database.client.companionMessage.create({
      data: { companionId: companion.id, role: 'user', content: 'hello' }
    });
    const turn = await database.client.companionTurn.create({
      data: {
        companionId: companion.id,
        sequence: 1,
        userMessageId: userMessage.id,
        status: 'pending'
      }
    });
    await database.client.companionMessage.update({
      where: { id: userMessage.id },
      data: { turnId: turn.id }
    });
    expect(
      (await database.client.companionTurn.findUnique({ where: { id: turn.id } }))?.companionId
    ).toBe(companion.id);
  });
});
