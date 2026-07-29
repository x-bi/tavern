import { describe, expect, it } from 'vitest';

import { TestDatabase } from '../helpers/test-database';

describe('image generation persistence invariants', () => {
  it('enforces user request idempotency and one lease per source message', async () => {
    const database = await TestDatabase.create();
    try {
      const user = await database.client.user.create({
        data: { username: 'image-owner', displayName: 'Image Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Character' }
      });
      const provider = await database.client.modelProvider.create({
        data: {
          userId: user.id,
          name: 'Provider',
          baseUrl: 'https://example.invalid/v1'
        }
      });
      const imageModel = await database.client.providerModel.create({
        data: {
          providerId: provider.id,
          name: 'Image',
          model: 'image-1',
          capability: 'image'
        }
      });
      const group = await database.client.modelFallbackGroup.create({
        data: {
          userId: user.id,
          name: 'Image Chain',
          capability: 'image',
          candidates: { create: { modelId: imageModel.id, priority: 1 } }
        }
      });
      const conversation = await database.client.conversation.create({
        data: {
          userId: user.id,
          characterId: character.id,
          title: 'Conversation',
          imageModelFallbackGroupId: group.id
        }
      });
      const message = await database.client.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: 'scene',
          status: 'complete'
        }
      });
      const createBatch = (requestId: string) =>
        database.client.imageGenerationBatch.create({
          data: {
            userId: user.id,
            conversationId: conversation.id,
            sourceMessageId: message.id,
            requestId,
            requestHash: 'hash',
            modelFallbackGroupId: group.id,
            stylePreset: 'auto',
            requestedImageCount: 1,
            aspectRatio: '1:1',
            sourceMessageContentHash: 'source-hash',
            scenePromptVersion: 'scene_image_prompt_v1',
            promptCompilerVersion: 'scene_image_compiler_v1'
          }
        });
      const batch = await createBatch('request-1');
      await database.client.imageGenerationLease.create({
        data: {
          sourceMessageId: message.id,
          batchId: batch.id,
          leaseId: 'lease-1',
          expiresAt: new Date(Date.now() + 60_000)
        }
      });
      await expect(createBatch('request-1')).rejects.toMatchObject({ code: 'P2002' });
      const otherBatch = await createBatch('request-2');
      await expect(
        database.client.imageGenerationLease.create({
          data: {
            sourceMessageId: message.id,
            batchId: otherBatch.id,
            leaseId: 'lease-2',
            expiresAt: new Date(Date.now() + 60_000)
          }
        })
      ).rejects.toMatchObject({ code: 'P2002' });
    } finally {
      await database.close();
    }
  });
});
