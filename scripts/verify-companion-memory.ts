import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getMemoryUpdateMode,
  parseMemorySummary,
  selectLatestSafeRevision,
  selectMessagesAfterPosition,
  shouldInvalidateMemory,
  type MessagePosition
} from '../apps/server/src/modules/companion-memory/companion-memory.utils';

const at = (id: string, milliseconds: number): MessagePosition => ({
  id,
  createdAt: new Date(milliseconds)
});

const floor = at('floor', 100);
const cursor = at('cursor', 200);
const changedBeforeCursor = at('changed-before', 150);
const changedAfterCursor = at('changed-after', 250);

assert.equal(getMemoryUpdateMode(true, false, 'stale'), 'rebuild');
assert.equal(getMemoryUpdateMode(true, true, 'stale'), 'none');
assert.equal(getMemoryUpdateMode(false, false, 'ready'), 'none');

assert.equal(shouldInvalidateMemory('ready', changedBeforeCursor, cursor, floor), true);
assert.equal(shouldInvalidateMemory('ready', changedAfterCursor, cursor, floor), false);
assert.equal(shouldInvalidateMemory('updating', changedAfterCursor, cursor, floor), true);
assert.equal(shouldInvalidateMemory('updating', floor, cursor, floor), false);

assert.deepEqual(
  selectMessagesAfterPosition([at('before', 50), at('after', 250)], cursor).map(
    (message) => message.id
  ),
  ['after']
);

const revisions = [
  { version: 3, lastSummarizedMessageId: 'after-change' },
  { version: 2, lastSummarizedMessageId: 'safe' },
  { version: 1, lastSummarizedMessageId: 'before-floor' }
];
const safeRevision = selectLatestSafeRevision(
  revisions,
  new Map([
    ['after-change', at('after-change', 300)],
    ['safe', at('safe', 180)],
    ['before-floor', at('before-floor', 50)]
  ]),
  cursor,
  floor
);
assert.equal(safeRevision?.version, 2);

assert.throws(
  () => parseMemorySummary('{}', { relationshipState: '旧关系', currentArc: '旧主线' }),
  /MEMORY_SUMMARY_INVALID/
);
assert.deepEqual(
  parseMemorySummary('```json\n{"relationshipState":"","currentArc":"新主线 {保留花括号}"}\n```', {
    relationshipState: '旧关系',
    currentArc: '旧主线'
  }),
  { relationshipState: '旧关系', currentArc: '新主线 {保留花括号}' }
);

const serverPackage = JSON.parse(
  readFileSync(resolve(__dirname, '../apps/server/package.json'), 'utf8')
) as { scripts?: Record<string, string> };
assert.equal(serverPackage.scripts?.predev, 'pnpm db:migrate');
assert.equal(serverPackage.scripts?.prestart, 'pnpm db:migrate');
assert.equal(
  serverPackage.scripts?.['db:migrate'],
  'prisma migrate deploy --schema ../../prisma/schema.prisma'
);

const rebuildCursorMigration = readFileSync(
  resolve(
    __dirname,
    '../prisma/migrations/20260717220000_add_companion_memory_rebuild_cursors/migration.sql'
  ),
  'utf8'
);
for (const column of [
  'CompanionMemory" ADD COLUMN "rebuildFromMessageId',
  'CompanionMemory" ADD COLUMN "historyFloorMessageId',
  'CompanionMemoryRevision" ADD COLUMN "historyFloorMessageId'
]) {
  assert.ok(rebuildCursorMigration.includes(column), `Missing migration column: ${column}`);
}

const memoryService = readFileSync(
  resolve(__dirname, '../apps/server/src/modules/companion-memory/companion-memory.service.ts'),
  'utf8'
);
assert.ok(memoryService.includes('await this.retryDue();'));
assert.ok(memoryService.includes('this.retryDue().catch'));

console.log('Companion memory regression checks passed (10 groups).');
