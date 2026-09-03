-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CompanionTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "completedOrdinal" INTEGER,
    "userMessageId" TEXT,
    "activeAssistantMessageId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CompanionTurn_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionTurn_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionTurn_activeAssistantMessageId_fkey" FOREIGN KEY ("activeAssistantMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanionTurn" ("activeAssistantMessageId", "companionId", "completedAt", "completedOrdinal", "createdAt", "id", "sequence", "status", "userMessageId") SELECT "activeAssistantMessageId", "companionId", "completedAt", "completedOrdinal", "createdAt", "id", "sequence", "status", "userMessageId" FROM "CompanionTurn";
DROP TABLE "CompanionTurn";
ALTER TABLE "new_CompanionTurn" RENAME TO "CompanionTurn";
CREATE UNIQUE INDEX "CompanionTurn_userMessageId_key" ON "CompanionTurn"("userMessageId");
CREATE UNIQUE INDEX "CompanionTurn_activeAssistantMessageId_key" ON "CompanionTurn"("activeAssistantMessageId");
CREATE UNIQUE INDEX "CompanionTurn_companionId_sequence_key" ON "CompanionTurn"("companionId", "sequence");
CREATE UNIQUE INDEX "CompanionTurn_companionId_completedOrdinal_key" ON "CompanionTurn"("companionId", "completedOrdinal");
CREATE INDEX "CompanionTurn_companionId_status_idx" ON "CompanionTurn"("companionId", "status");

CREATE TABLE "new_CompanionMessageGenerationTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "generationRequestId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "requestUserMessageId" TEXT,
    "generationPurpose" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "rootUserMessageId" TEXT,
    "memoryRevisionIdUsed" TEXT,
    "promptSnapshotJson" TEXT NOT NULL,
    "promptSnapshotHash" TEXT NOT NULL,
    "capabilitiesSnapshotJson" TEXT NOT NULL,
    "modelParametersJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionMessageGenerationTrace_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "CompanionGenerationRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CompanionMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_requestUserMessageId_fkey" FOREIGN KEY ("requestUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "CompanionTurn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_memoryRevisionIdUsed_fkey" FOREIGN KEY ("memoryRevisionIdUsed") REFERENCES "CompanionMemoryRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanionMessageGenerationTrace" ("capabilitiesSnapshotJson", "compilerVersion", "createdAt", "generationPurpose", "generationRequestId", "id", "memoryRevisionIdUsed", "messageId", "modelId", "modelParametersJson", "promptSnapshotHash", "promptSnapshotJson", "requestUserMessageId", "rootUserMessageId", "turnId") SELECT "capabilitiesSnapshotJson", "compilerVersion", "createdAt", "generationPurpose", "generationRequestId", "id", "memoryRevisionIdUsed", "messageId", "modelId", "modelParametersJson", "promptSnapshotHash", "promptSnapshotJson", "requestUserMessageId", "rootUserMessageId", "turnId" FROM "CompanionMessageGenerationTrace";
DROP TABLE "CompanionMessageGenerationTrace";
ALTER TABLE "new_CompanionMessageGenerationTrace" RENAME TO "CompanionMessageGenerationTrace";
CREATE UNIQUE INDEX "CompanionMessageGenerationTrace_messageId_key" ON "CompanionMessageGenerationTrace"("messageId");
CREATE UNIQUE INDEX "CompanionMessageGenerationTrace_generationRequestId_key" ON "CompanionMessageGenerationTrace"("generationRequestId");
CREATE INDEX "CompanionMessageGenerationTrace_turnId_createdAt_idx" ON "CompanionMessageGenerationTrace"("turnId", "createdAt");
CREATE INDEX "CompanionMessageGenerationTrace_rootUserMessageId_idx" ON "CompanionMessageGenerationTrace"("rootUserMessageId");
CREATE INDEX "CompanionMessageGenerationTrace_memoryRevisionIdUsed_idx" ON "CompanionMessageGenerationTrace"("memoryRevisionIdUsed");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
