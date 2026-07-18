ALTER TABLE "CompanionMemory" ADD COLUMN "rebuildFromMessageId" TEXT;
ALTER TABLE "CompanionMemory" ADD COLUMN "historyFloorMessageId" TEXT;
ALTER TABLE "CompanionMemoryRevision" ADD COLUMN "historyFloorMessageId" TEXT;
