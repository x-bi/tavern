import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  readonly client: PrismaClient;
  readonly databasePath: string;
  readonly databaseUrl: string;

  private constructor(private readonly directory: string) {
    this.databasePath = join(directory, 'test.db');
    this.databaseUrl = `file:${this.databasePath.replaceAll('\\', '/')}`;
    this.client = new PrismaClient({ datasources: { db: { url: this.databaseUrl } } });
  }

  static async create(): Promise<TestDatabase> {
    const directory = await mkdtemp(join(tmpdir(), 'tavern-test-'));
    const database = new TestDatabase(directory);
    const workspaceRoot = resolve(__dirname, '../../../..');
    const migrationsRoot = resolve(workspaceRoot, 'prisma/migrations');
    const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const sqlite = new DatabaseSync(database.databasePath);
    try {
      for (const migrationDirectory of migrationDirectories) {
        const sql = await readFile(
          resolve(migrationsRoot, migrationDirectory, 'migration.sql'),
          'utf8'
        );
        sqlite.exec(sql);
      }
    } finally {
      sqlite.close();
    }
    await database.client.$connect();
    return database;
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
    await rm(this.directory, { recursive: true, force: true });
  }
}
