-- CreateTable
CREATE TABLE "Companion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatarAssetId" TEXT,
    "modelFallbackGroupId" TEXT,
    "promptPresetId" TEXT,
    "personaId" TEXT,
    "name" TEXT NOT NULL,
    "identityPrompt" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Companion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Companion_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_modelFallbackGroupId_fkey" FOREIGN KEY ("modelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_promptPresetId_fkey" FOREIGN KEY ("promptPresetId") REFERENCES "PromptPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "metadataJson" TEXT,
    "tokenCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CompanionMessage_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "memoryModelFallbackGroupId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "relationshipState" TEXT NOT NULL DEFAULT '',
    "currentArc" TEXT NOT NULL DEFAULT '',
    "lastSummarizedMessageId" TEXT,
    "updateEveryMessages" INTEGER NOT NULL DEFAULT 8,
    "lastErrorCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanionMemory_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionMemory_memoryModelFallbackGroupId_fkey" FOREIGN KEY ("memoryModelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionMemoryRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "relationshipState" TEXT NOT NULL,
    "currentArc" TEXT NOT NULL,
    "lastSummarizedMessageId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionMemoryRevision_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionMemory" ("companionId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Companion_userId_updatedAt_idx" ON "Companion"("userId", "updatedAt");
CREATE INDEX "Companion_deletedAt_idx" ON "Companion"("deletedAt");
CREATE INDEX "CompanionMessage_companionId_createdAt_idx" ON "CompanionMessage"("companionId", "createdAt");
CREATE INDEX "CompanionMessage_status_idx" ON "CompanionMessage"("status");
CREATE UNIQUE INDEX "CompanionMemory_companionId_key" ON "CompanionMemory"("companionId");
CREATE INDEX "CompanionMemory_status_nextRetryAt_idx" ON "CompanionMemory"("status", "nextRetryAt");
CREATE INDEX "CompanionMemoryRevision_companionId_createdAt_idx" ON "CompanionMemoryRevision"("companionId", "createdAt");
CREATE UNIQUE INDEX "CompanionMemoryRevision_companionId_version_key" ON "CompanionMemoryRevision"("companionId", "version");
