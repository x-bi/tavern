import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { PresetsService } from '../../src/modules/presets/presets.service';
import type { CurrentUser } from '../../src/modules/users/user.types';
import { TestDatabase } from '../helpers/test-database';

const seedUser: CurrentUser = {
  id: 'seed_user_demo',
  username: 'demo',
  displayName: 'Demo',
  role: 'user'
};

async function ensureUser(database: TestDatabase): Promise<CurrentUser> {
  await database.client.user.upsert({
    where: { id: seedUser.id },
    update: { username: seedUser.username, displayName: seedUser.displayName },
    create: { id: seedUser.id, username: seedUser.username, displayName: seedUser.displayName }
  });
  return seedUser;
}

function makeService(database: TestDatabase): PresetsService {
  const prisma = database.client;
  return new PresetsService(
    prisma as unknown as Parameters<typeof PresetsService.prototype.create>[0] & object,
    {
      resolveAccess: async () => ({
        isManaged: false,
        owner: seedUser,
        ownerName: seedUser.displayName
      }),
      getOwnerNameMap: async () => new Map(),
      assertCanSetShared: async () => undefined,
      getOwner: async () => seedUser
    } as unknown as never,
    { shouldShowSensitiveContent: async () => true } as unknown as never
  );
}

function readError(error: unknown): { code: string; message: string } {
  if (error instanceof BadRequestException) {
    const response = error.getResponse() as { code?: string; message?: string };
    return { code: response.code ?? '', message: response.message ?? '' };
  }
  throw error;
}

function pack(payload: Record<string, unknown>): string {
  return JSON.stringify({ formatVersion: 'tavern-lite.prompt-preset.v2', ...payload });
}

describe('prompt preset V2-only import', () => {
  it('imports a full V2 preset with all six parameters', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await ensureUser(database);
      const result = await service.importJson(seedUser, {
        rawJson: pack({
          name: 'V2 Test Preset',
          description: 'V2-only test',
          instructions: ['Stay in character.'],
          outputRuleOperations: [
            { key: 'style', content: 'Natural.', operation: 'add', sortOrder: 0 }
          ],
          generationPurposes: ['chat_reply', 'user_suggestions'],
          parameters: {
            temperature: 0.8,
            topP: 0.9,
            maxTokens: 1200,
            timeout: 30000,
            frequencyPenalty: 0,
            presencePenalty: 0
          },
          metadata: {}
        }),
        commit: true
      });

      expect(result.imported).toBe(true);
      expect(result.promptPreset).toMatchObject({
        name: 'V2 Test Preset',
        instructions: ['Stay in character.'],
        generationPurposes: ['chat_reply', 'user_suggestions'],
        temperature: 0.8,
        topP: 0.9,
        maxTokens: 1200,
        timeout: 30000,
        frequencyPenalty: 0,
        presencePenalty: 0
      });
      expect(result.promptPreset!.outputRuleOperations).toHaveLength(1);

      // §6.7 列重命名验证：新列 outputRuleOperationsJson 可读写，旧列 outputRulesJson 不存在。
      const row = await database.client.promptPreset.findFirstOrThrow({
        where: { userId: seedUser.id }
      });
      expect(JSON.parse(row.outputRuleOperationsJson)).toEqual([
        { key: 'style', content: 'Natural.', operation: 'add', sortOrder: 0 }
      ]);
      expect((row as Record<string, unknown>).outputRulesJson).toBeUndefined();
    } finally {
      await database.close();
    }
  });

  it('rejects V1 format version', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: JSON.stringify({
            formatVersion: 'tavern-lite.prompt-preset.v1',
            name: 'V1'
          }),
          commit: false
        })
      ).rejects.toSatisfy(
        (error: unknown) => readError(error).code === 'MODULE_IMPORT_INVALID_FORMAT'
      );
    } finally {
      await database.close();
    }
  });

  it('rejects pseudo-V2 with V1 fields', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({
            name: 'Invalid',
            systemPrompt: 'legacy',
            outputRules: 'legacy',
            instructions: [],
            outputRuleOperations: [],
            generationPurposes: []
          }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) => {
        const { message } = readError(error);
        return message.includes('systemPrompt') && message.includes('V1');
      });
    } finally {
      await database.close();
    }
  });

  it('rejects unknown root fields', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({
            name: 'Unknown',
            instructions: [],
            outputRuleOperations: [],
            generationPurposes: [],
            surprise: 1
          }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) => readError(error).message.includes('surprise'));
    } finally {
      await database.close();
    }
  });

  it('rejects snake_case parameters', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      for (const snakeField of ['top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty']) {
        await expect(
          service.importJson(seedUser, {
            rawJson: pack({
              name: 'Snake',
              instructions: [],
              outputRuleOperations: [],
              generationPurposes: [],
              parameters: { [snakeField]: 1 }
            }),
            commit: false
          })
        ).rejects.toSatisfy((error: unknown) => readError(error).message.includes(snakeField));
      }
    } finally {
      await database.close();
    }
  });

  it('rejects illegal operation', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({
            name: 'BadOp',
            instructions: [],
            outputRuleOperations: [
              { key: 'test', content: 'test', operation: 'replace', sortOrder: 0 }
            ],
            generationPurposes: []
          }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) => readError(error).message.includes('operation'));
    } finally {
      await database.close();
    }
  });

  it('rejects malformed output rule elements', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      const cases = [
        { key: 1, content: 'x', operation: 'add', sortOrder: 0 },
        { key: 'x', content: { deep: 1 }, operation: 'add', sortOrder: 0 },
        { key: 'x', content: 'y', operation: 'add', sortOrder: 'zero' },
        { key: 'x', content: 'y', operation: 'add', sortOrder: -1 },
        { key: 'x', content: 'y', operation: 'add', sortOrder: 1.5 },
        { key: 'x', content: 'y', operation: 'add', sortOrder: 0, extra: true },
        { key: 'x', content: 'y', sortOrder: 0 },
        null,
        'mixed'
      ];
      for (const element of cases) {
        await expect(
          service.importJson(seedUser, {
            rawJson: pack({
              name: 'BadElement',
              instructions: [],
              outputRuleOperations: [element],
              generationPurposes: []
            }),
            commit: false
          })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    } finally {
      await database.close();
    }
  });

  it('rejects duplicate output rule keys', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({
            name: 'Duplicate rules',
            instructions: [],
            outputRuleOperations: [
              { key: 'style', content: 'first', operation: 'add', sortOrder: 0 },
              { key: ' style ', content: 'second', operation: 'add', sortOrder: 1 }
            ],
            generationPurposes: []
          }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) => readError(error).message.includes('duplicates'));
    } finally {
      await database.close();
    }
  });

  it('rejects out-of-range and fractional parameters without truncating', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      const cases: Array<[string, number]> = [
        ['temperature', 2.1],
        ['topP', -0.1],
        ['maxTokens', 1.5],
        ['maxTokens', 200001],
        ['timeout', 999],
        ['timeout', 1000.5],
        ['frequencyPenalty', -2.1],
        ['presencePenalty', 2.1]
      ];

      for (const [field, value] of cases) {
        await expect(
          service.importJson(seedUser, {
            rawJson: pack({
              name: `Invalid ${field}`,
              instructions: [],
              outputRuleOperations: [],
              generationPurposes: [],
              parameters: { [field]: value }
            }),
            commit: false
          })
        ).rejects.toSatisfy((error: unknown) => readError(error).message.includes(field));
      }
    } finally {
      await database.close();
    }
  });

  it('rejects required V2 fields when missing', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({ name: 'Missing' }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) =>
        readError(error).message.includes('instructions is required')
      );
    } finally {
      await database.close();
    }
  });

  it('rejects duplicate generation purposes', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await expect(
        service.importJson(seedUser, {
          rawJson: pack({
            name: 'Dup',
            instructions: [],
            outputRuleOperations: [],
            generationPurposes: ['chat_reply', 'chat_reply']
          }),
          commit: false
        })
      ).rejects.toSatisfy((error: unknown) => readError(error).message.includes('duplicates'));
    } finally {
      await database.close();
    }
  });

  it('round-trips a V2 preset through export then import', async () => {
    const database = await TestDatabase.create();
    try {
      const service = makeService(database);
      await ensureUser(database);
      const created = await service.importJson(seedUser, {
        rawJson: pack({
          name: 'Round Trip',
          description: '无损还原',
          instructions: ['第一', '第二'],
          outputRuleOperations: [
            { key: 'style', content: '自然口语。', operation: 'add', sortOrder: 5 },
            { key: 'tone', content: '温和。', operation: 'replace_optional', sortOrder: 10 }
          ],
          generationPurposes: ['chat_reply', 'continue', 'memory_summary'],
          parameters: {
            temperature: 0.77,
            topP: 0.88,
            maxTokens: 2048,
            timeout: 45000,
            frequencyPenalty: -0.3,
            presencePenalty: 0.6
          },
          metadata: { tags: ['a', 'b'] }
        }),
        commit: true
      });

      const exported = await service.exportJson(seedUser, created.promptPreset!.id);
      const reimported = await service.importJson(seedUser, {
        rawJson: JSON.stringify({ ...exported.card, name: 'Round Trip Reimported' }),
        commit: true
      });

      expect(reimported.imported).toBe(true);
      expect(reimported.promptPreset).toMatchObject({
        name: 'Round Trip Reimported',
        description: '无损还原',
        instructions: ['第一', '第二'],
        generationPurposes: ['chat_reply', 'continue', 'memory_summary'],
        temperature: 0.77,
        topP: 0.88,
        maxTokens: 2048,
        timeout: 45000,
        frequencyPenalty: -0.3,
        presencePenalty: 0.6
      });
      expect(reimported.promptPreset!.outputRuleOperations).toEqual(
        created.promptPreset!.outputRuleOperations
      );
    } finally {
      await database.close();
    }
  });
});
