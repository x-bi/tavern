-- Finalize the context-engine contracts:
-- 1. Compact world-book content records the source content hash.
-- 2. Companion memory projections live only in immutable revision dataJson.
ALTER TABLE "WorldBookEntryRevision" ADD COLUMN "compactSourceHash" TEXT;

ALTER TABLE "CompanionMemory" DROP COLUMN "relationshipState";
ALTER TABLE "CompanionMemory" DROP COLUMN "currentArc";

ALTER TABLE "CompanionMemoryRevision" DROP COLUMN "relationshipState";
ALTER TABLE "CompanionMemoryRevision" DROP COLUMN "currentArc";
