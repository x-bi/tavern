import { afterEach, describe, expect, it } from 'vitest';
import { TestDatabase } from '../helpers/test-database';

let database: TestDatabase | undefined;

afterEach(async () => {
  await database?.close();
  database = undefined;
});

describe('T0a isolated SQLite', () => {
  it('creates and writes an isolated database from the current Prisma schema', async () => {
    database = await TestDatabase.create();
    expect(database.databasePath).not.toContain('data\\tavern-lite.db');
    const user = await database.client.user.create({
      data: { username: 'test-user', displayName: 'Test User' }
    });
    expect(await database.client.user.count()).toBe(1);
    expect(user.username).toBe('test-user');
  });
});
