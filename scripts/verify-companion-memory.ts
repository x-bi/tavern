import { strict as assert } from 'node:assert';
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

console.log('Companion memory regression checks passed (7 groups).');
