-- CreateTable
CREATE TABLE "WorldBookPersona" (
    "worldBookId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("worldBookId", "personaId"),
    CONSTRAINT "WorldBookPersona_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookPersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldBookConversation" (
    "worldBookId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("worldBookId", "conversationId"),
    CONSTRAINT "WorldBookConversation_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldBookCompanion" (
    "worldBookId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("worldBookId", "companionId"),
    CONSTRAINT "WorldBookCompanion_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookCompanion_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldBookEntryRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configJson" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "compactContent" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldBookEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationWorldBookActivationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "activatedByMessageId" TEXT,
    "rootUserMessageId" TEXT,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    "activatedAtCompletedTurn" INTEGER,
    "stickyUntilCompletedTurn" INTEGER,
    "continuationUntilCompletedTurn" INTEGER,
    "cooldownUntilCompletedTurn" INTEGER,
    "pendingUntilCompletedTurn" INTEGER,
    "manualActive" BOOLEAN NOT NULL DEFAULT false,
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ConversationWorldBookActivationState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationState_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationState_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationState_activatedByMessageId_fkey" FOREIGN KEY ("activatedByMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationState_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionWorldBookActivationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "activatedByMessageId" TEXT,
    "rootUserMessageId" TEXT,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    "activatedAtCompletedTurn" INTEGER,
    "stickyUntilCompletedTurn" INTEGER,
    "continuationUntilCompletedTurn" INTEGER,
    "cooldownUntilCompletedTurn" INTEGER,
    "pendingUntilCompletedTurn" INTEGER,
    "manualActive" BOOLEAN NOT NULL DEFAULT false,
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CompanionWorldBookActivationState_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationState_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationState_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationState_activatedByMessageId_fkey" FOREIGN KEY ("activatedByMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationState_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationWorldBookActivationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "rootUserMessageId" TEXT,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    "completedTurn" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationWorldBookActivationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationEvent_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationEvent_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConversationWorldBookActivationEvent_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionWorldBookActivationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "rootUserMessageId" TEXT,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    "completedTurn" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionWorldBookActivationEvent_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationEvent_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationEvent_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanionWorldBookActivationEvent_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationIncludedWorldBookTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationTraceId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "activationSource" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "rootUserMessageId" TEXT NOT NULL,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    CONSTRAINT "ConversationIncludedWorldBookTrace_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "ConversationMessageGenerationTrace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationIncludedWorldBookTrace_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationIncludedWorldBookTrace_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionIncludedWorldBookTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationTraceId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryRevisionId" TEXT NOT NULL,
    "activationSource" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "rootUserMessageId" TEXT NOT NULL,
    "lineageJson" TEXT NOT NULL,
    "bridgeDepth" INTEGER NOT NULL,
    CONSTRAINT "CompanionIncludedWorldBookTrace_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "CompanionMessageGenerationTrace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionIncludedWorldBookTrace_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WorldBookEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionIncludedWorldBookTrace_entryRevisionId_fkey" FOREIGN KEY ("entryRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionRuntimeState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "currentMood" TEXT,
    "currentSituation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanionRuntimeState_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatarAssetId" TEXT,
    "name" TEXT NOT NULL,
    "coreIdentity" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "persistentPremise" TEXT NOT NULL DEFAULT '',
    "initialScenario" TEXT NOT NULL DEFAULT '',
    "extendedBackground" TEXT NOT NULL DEFAULT '',
    "characterRules" TEXT NOT NULL DEFAULT '',
    "speechStyle" TEXT NOT NULL DEFAULT '',
    "scenario" TEXT NOT NULL DEFAULT '',
    "firstMessage" TEXT NOT NULL DEFAULT '',
    "exampleMessagesJson" TEXT,
    "metadataJson" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Character_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("avatarAssetId", "createdAt", "deletedAt", "description", "exampleMessagesJson", "firstMessage", "id", "isArchived", "isSensitive", "isShared", "metadataJson", "name", "personality", "scenario", "updatedAt", "userId") SELECT "avatarAssetId", "createdAt", "deletedAt", "description", "exampleMessagesJson", "firstMessage", "id", "isArchived", "isSensitive", "isShared", "metadataJson", "name", "personality", "scenario", "updatedAt", "userId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE INDEX "Character_userId_isSensitive_idx" ON "Character"("userId", "isSensitive");
CREATE INDEX "Character_isShared_idx" ON "Character"("isShared");
CREATE INDEX "Character_userId_isArchived_idx" ON "Character"("userId", "isArchived");
CREATE INDEX "Character_name_idx" ON "Character"("name");
CREATE INDEX "Character_deletedAt_idx" ON "Character"("deletedAt");
CREATE TABLE "new_Companion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatarAssetId" TEXT,
    "modelFallbackGroupId" TEXT,
    "promptPresetId" TEXT,
    "personaId" TEXT,
    "name" TEXT NOT NULL,
    "identityPrompt" TEXT NOT NULL DEFAULT '',
    "coreIdentity" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "speechStyle" TEXT NOT NULL DEFAULT '',
    "relationshipDefaults" TEXT NOT NULL DEFAULT '',
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "activeGenerationLeaseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Companion_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_modelFallbackGroupId_fkey" FOREIGN KEY ("modelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_promptPresetId_fkey" FOREIGN KEY ("promptPresetId") REFERENCES "PromptPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Companion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Companion" ("activeGenerationLeaseId", "avatarAssetId", "createdAt", "deletedAt", "id", "identityPrompt", "isSensitive", "isShared", "modelFallbackGroupId", "name", "personaId", "promptPresetId", "updatedAt", "userId", "version") SELECT "activeGenerationLeaseId", "avatarAssetId", "createdAt", "deletedAt", "id", "identityPrompt", "isSensitive", "isShared", "modelFallbackGroupId", "name", "personaId", "promptPresetId", "updatedAt", "userId", "version" FROM "Companion";
DROP TABLE "Companion";
ALTER TABLE "new_Companion" RENAME TO "Companion";
CREATE INDEX "Companion_userId_updatedAt_idx" ON "Companion"("userId", "updatedAt");
CREATE INDEX "Companion_userId_isSensitive_idx" ON "Companion"("userId", "isSensitive");
CREATE INDEX "Companion_isShared_idx" ON "Companion"("isShared");
CREATE INDEX "Companion_deletedAt_idx" ON "Companion"("deletedAt");
CREATE TABLE "new_CompanionMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "memoryModelFallbackGroupId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "activeRevisionId" TEXT,
    "workingRevisionId" TEXT,
    "relationshipState" TEXT NOT NULL DEFAULT '',
    "currentArc" TEXT NOT NULL DEFAULT '',
    "lastSummarizedMessageId" TEXT,
    "rebuildFromMessageId" TEXT,
    "historyFloorMessageId" TEXT,
    "updateEveryMessages" INTEGER NOT NULL DEFAULT 8,
    "lastErrorCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanionMemory_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionMemory_memoryModelFallbackGroupId_fkey" FOREIGN KEY ("memoryModelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanionMemory_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "CompanionMemoryRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanionMemory_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "CompanionMemoryRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanionMemory" ("companionId", "createdAt", "currentArc", "historyFloorMessageId", "id", "isEnabled", "isPaused", "lastErrorCode", "lastSummarizedMessageId", "memoryModelFallbackGroupId", "nextRetryAt", "rebuildFromMessageId", "relationshipState", "retryCount", "status", "updateEveryMessages", "updatedAt") SELECT "companionId", "createdAt", "currentArc", "historyFloorMessageId", "id", "isEnabled", "isPaused", "lastErrorCode", "lastSummarizedMessageId", "memoryModelFallbackGroupId", "nextRetryAt", "rebuildFromMessageId", "relationshipState", "retryCount", "status", "updateEveryMessages", "updatedAt" FROM "CompanionMemory";
DROP TABLE "CompanionMemory";
ALTER TABLE "new_CompanionMemory" RENAME TO "CompanionMemory";
CREATE UNIQUE INDEX "CompanionMemory_companionId_key" ON "CompanionMemory"("companionId");
CREATE UNIQUE INDEX "CompanionMemory_activeRevisionId_key" ON "CompanionMemory"("activeRevisionId");
CREATE UNIQUE INDEX "CompanionMemory_workingRevisionId_key" ON "CompanionMemory"("workingRevisionId");
CREATE INDEX "CompanionMemory_status_nextRetryAt_idx" ON "CompanionMemory"("status", "nextRetryAt");
CREATE TABLE "new_CompanionMemoryRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dataJson" TEXT NOT NULL DEFAULT '{"claims":[],"relationshipSummary":{"content":"","sourceClaimIds":[]},"currentArc":{"content":"","sourceClaimIds":[]}}',
    "dataHash" TEXT NOT NULL DEFAULT '',
    "sourceStartMessageId" TEXT,
    "sourceEndMessageId" TEXT,
    "sourceCompletedOrdinal" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "relationshipState" TEXT NOT NULL,
    "currentArc" TEXT NOT NULL,
    "lastSummarizedMessageId" TEXT,
    "historyFloorMessageId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionMemoryRevision_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "CompanionMemory" ("companionId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CompanionMemoryRevision" ("companionId", "createdAt", "currentArc", "historyFloorMessageId", "id", "lastSummarizedMessageId", "reason", "relationshipState", "version") SELECT "companionId", "createdAt", "currentArc", "historyFloorMessageId", "id", "lastSummarizedMessageId", "reason", "relationshipState", "version" FROM "CompanionMemoryRevision";
DROP TABLE "CompanionMemoryRevision";
ALTER TABLE "new_CompanionMemoryRevision" RENAME TO "CompanionMemoryRevision";
CREATE INDEX "CompanionMemoryRevision_companionId_createdAt_idx" ON "CompanionMemoryRevision"("companionId", "createdAt");
CREATE UNIQUE INDEX "CompanionMemoryRevision_companionId_version_key" ON "CompanionMemoryRevision"("companionId", "version");
CREATE TABLE "new_CompanionMessageGenerationTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "generationRequestId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "requestUserMessageId" TEXT NOT NULL,
    "generationPurpose" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "rootUserMessageId" TEXT NOT NULL,
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
CREATE TABLE "new_PromptPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "outputRules" TEXT NOT NULL DEFAULT '',
    "instructionsJson" TEXT NOT NULL DEFAULT '[]',
    "outputRulesJson" TEXT NOT NULL DEFAULT '[]',
    "generationPurposesJson" TEXT NOT NULL DEFAULT '["chat_reply","regenerate","continue"]',
    "parametersJson" TEXT,
    "metadataJson" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PromptPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PromptPreset" ("createdAt", "deletedAt", "description", "id", "isDefault", "isSensitive", "isShared", "metadataJson", "name", "outputRules", "parametersJson", "systemPrompt", "updatedAt", "userId") SELECT "createdAt", "deletedAt", "description", "id", "isDefault", "isSensitive", "isShared", "metadataJson", "name", "outputRules", "parametersJson", "systemPrompt", "updatedAt", "userId" FROM "PromptPreset";
DROP TABLE "PromptPreset";
ALTER TABLE "new_PromptPreset" RENAME TO "PromptPreset";
CREATE INDEX "PromptPreset_userId_isSensitive_idx" ON "PromptPreset"("userId", "isSensitive");
CREATE INDEX "PromptPreset_isShared_idx" ON "PromptPreset"("isShared");
CREATE INDEX "PromptPreset_userId_isDefault_idx" ON "PromptPreset"("userId", "isDefault");
CREATE INDEX "PromptPreset_deletedAt_idx" ON "PromptPreset"("deletedAt");
CREATE UNIQUE INDEX "PromptPreset_userId_name_key" ON "PromptPreset"("userId", "name");
CREATE TABLE "new_UserPersona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "coreIdentity" TEXT NOT NULL DEFAULT '',
    "background" TEXT NOT NULL DEFAULT '',
    "interactionPreferences" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UserPersona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserPersona" ("content", "createdAt", "deletedAt", "id", "isDefault", "isSensitive", "isShared", "metadataJson", "name", "updatedAt", "userId") SELECT "content", "createdAt", "deletedAt", "id", "isDefault", "isSensitive", "isShared", "metadataJson", "name", "updatedAt", "userId" FROM "UserPersona";
DROP TABLE "UserPersona";
ALTER TABLE "new_UserPersona" RENAME TO "UserPersona";
CREATE INDEX "UserPersona_userId_isSensitive_idx" ON "UserPersona"("userId", "isSensitive");
CREATE INDEX "UserPersona_isShared_idx" ON "UserPersona"("isShared");
CREATE INDEX "UserPersona_userId_isDefault_idx" ON "UserPersona"("userId", "isDefault");
CREATE INDEX "UserPersona_deletedAt_idx" ON "UserPersona"("deletedAt");
CREATE UNIQUE INDEX "UserPersona_userId_name_key" ON "UserPersona"("userId", "name");
CREATE TABLE "new_WorldBookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldBookId" TEXT NOT NULL,
    "activeRevisionId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "secondaryKeywordsJson" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "position" TEXT NOT NULL DEFAULT 'before_history',
    "tokenBudget" INTEGER,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WorldBookEntry_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookEntry_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorldBookEntry" ("caseSensitive", "content", "createdAt", "deletedAt", "id", "isEnabled", "keywordsJson", "metadataJson", "position", "priority", "secondaryKeywordsJson", "title", "tokenBudget", "updatedAt", "worldBookId") SELECT "caseSensitive", "content", "createdAt", "deletedAt", "id", "isEnabled", "keywordsJson", "metadataJson", "position", "priority", "secondaryKeywordsJson", "title", "tokenBudget", "updatedAt", "worldBookId" FROM "WorldBookEntry";
DROP TABLE "WorldBookEntry";
ALTER TABLE "new_WorldBookEntry" RENAME TO "WorldBookEntry";
CREATE UNIQUE INDEX "WorldBookEntry_activeRevisionId_key" ON "WorldBookEntry"("activeRevisionId");
CREATE INDEX "WorldBookEntry_worldBookId_isEnabled_idx" ON "WorldBookEntry"("worldBookId", "isEnabled");
CREATE INDEX "WorldBookEntry_priority_idx" ON "WorldBookEntry"("priority");
CREATE INDEX "WorldBookEntry_deletedAt_idx" ON "WorldBookEntry"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WorldBookPersona_personaId_idx" ON "WorldBookPersona"("personaId");

-- CreateIndex
CREATE INDEX "WorldBookConversation_conversationId_idx" ON "WorldBookConversation"("conversationId");

-- CreateIndex
CREATE INDEX "WorldBookCompanion_companionId_idx" ON "WorldBookCompanion"("companionId");

-- CreateIndex
CREATE INDEX "WorldBookEntryRevision_entryId_createdAt_idx" ON "WorldBookEntryRevision"("entryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorldBookEntryRevision_entryId_version_key" ON "WorldBookEntryRevision"("entryId", "version");

-- CreateIndex
CREATE INDEX "ConversationWorldBookActivationState_entryRevisionId_idx" ON "ConversationWorldBookActivationState"("entryRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationWorldBookActivationState_conversationId_entryId_key" ON "ConversationWorldBookActivationState"("conversationId", "entryId");

-- CreateIndex
CREATE INDEX "CompanionWorldBookActivationState_entryRevisionId_idx" ON "CompanionWorldBookActivationState"("entryRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionWorldBookActivationState_companionId_entryId_key" ON "CompanionWorldBookActivationState"("companionId", "entryId");

-- CreateIndex
CREATE INDEX "ConversationWorldBookActivationEvent_conversationId_completedTurn_idx" ON "ConversationWorldBookActivationEvent"("conversationId", "completedTurn");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationWorldBookActivationEvent_conversationId_entryId_entryRevisionId_sourceKey_key" ON "ConversationWorldBookActivationEvent"("conversationId", "entryId", "entryRevisionId", "sourceKey");

-- CreateIndex
CREATE INDEX "CompanionWorldBookActivationEvent_companionId_completedTurn_idx" ON "CompanionWorldBookActivationEvent"("companionId", "completedTurn");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionWorldBookActivationEvent_companionId_entryId_entryRevisionId_sourceKey_key" ON "CompanionWorldBookActivationEvent"("companionId", "entryId", "entryRevisionId", "sourceKey");

-- CreateIndex
CREATE INDEX "ConversationIncludedWorldBookTrace_entryRevisionId_idx" ON "ConversationIncludedWorldBookTrace"("entryRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationIncludedWorldBookTrace_generationTraceId_entryId_key" ON "ConversationIncludedWorldBookTrace"("generationTraceId", "entryId");

-- CreateIndex
CREATE INDEX "CompanionIncludedWorldBookTrace_entryRevisionId_idx" ON "CompanionIncludedWorldBookTrace"("entryRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionIncludedWorldBookTrace_generationTraceId_entryId_key" ON "CompanionIncludedWorldBookTrace"("generationTraceId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionRuntimeState_companionId_key" ON "CompanionRuntimeState"("companionId");
