import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { QqBridgeService } from '../../src/modules/qq-bridge/qq-bridge.service';
import { TestDatabase } from '../helpers/test-database';

describe('QQ bridge module wiring', () => {
  it('boots with the complete application module and a migrated database', async () => {
    const database = await TestDatabase.create();
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousPresetUsers = process.env.AUTH_PRESET_USERS_JSON;
    const previousTokenSecret = process.env.AUTH_TOKEN_SECRET;
    process.env.DATABASE_URL = database.databaseUrl;
    process.env.AUTH_PRESET_USERS_JSON = JSON.stringify([
      {
        username: 'qq-test-admin',
        displayName: 'QQ Test Admin',
        password: 'test-password',
        role: 'admin'
      }
    ]);
    process.env.AUTH_TOKEN_SECRET = 'qq-bridge-test-secret';

    let moduleRef: TestingModule | null = null;
    try {
      moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      await moduleRef.init();
      expect(moduleRef.get(QqBridgeService)).toBeInstanceOf(QqBridgeService);
    } finally {
      await moduleRef?.close();
      await database.close();
      restoreEnv('DATABASE_URL', previousDatabaseUrl);
      restoreEnv('AUTH_PRESET_USERS_JSON', previousPresetUsers);
      restoreEnv('AUTH_TOKEN_SECRET', previousTokenSecret);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
