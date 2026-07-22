ALTER TABLE "Conversation" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "activeGenerationLeaseId" TEXT;
ALTER TABLE "Companion" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Companion" ADD COLUMN "activeGenerationLeaseId" TEXT;

CREATE TABLE "ConversationGenerationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultMessageId" TEXT,
    "errorCode" TEXT,
    "baseVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ConversationGenerationRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationGenerationRequest_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "ConversationTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationGenerationRequest_resultMessageId_fkey" FOREIGN KEY ("resultMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversationGenerationRequest_conversationId_requestId_key" ON "ConversationGenerationRequest"("conversationId", "requestId");
CREATE INDEX "ConversationGenerationRequest_conversationId_status_idx" ON "ConversationGenerationRequest"("conversationId", "status");
CREATE INDEX "ConversationGenerationRequest_turnId_idx" ON "ConversationGenerationRequest"("turnId");

CREATE TABLE "ConversationGenerationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRequestId" TEXT NOT NULL,
    "attemptIndex" INTEGER NOT NULL,
    "modelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promptSnapshotHash" TEXT,
    "capabilitiesSnapshotJson" TEXT,
    "modelParametersJson" TEXT,
    "emittedDelta" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ConversationGenerationAttempt_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "ConversationGenerationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversationGenerationAttempt_generationRequestId_attemptIndex_key" ON "ConversationGenerationAttempt"("generationRequestId", "attemptIndex");
CREATE INDEX "ConversationGenerationAttempt_modelId_status_idx" ON "ConversationGenerationAttempt"("modelId", "status");

CREATE TABLE "ConversationMessageGenerationTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "generationRequestId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "requestUserMessageId" TEXT NOT NULL,
    "generationPurpose" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "rootUserMessageId" TEXT NOT NULL,
    "promptSnapshotJson" TEXT NOT NULL,
    "promptSnapshotHash" TEXT NOT NULL,
    "capabilitiesSnapshotJson" TEXT NOT NULL,
    "modelParametersJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessageGenerationTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationMessageGenerationTrace_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "ConversationGenerationRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationMessageGenerationTrace_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "ConversationTurn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationMessageGenerationTrace_requestUserMessageId_fkey" FOREIGN KEY ("requestUserMessageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationMessageGenerationTrace_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversationMessageGenerationTrace_messageId_key" ON "ConversationMessageGenerationTrace"("messageId");
CREATE UNIQUE INDEX "ConversationMessageGenerationTrace_generationRequestId_key" ON "ConversationMessageGenerationTrace"("generationRequestId");
CREATE INDEX "ConversationMessageGenerationTrace_turnId_createdAt_idx" ON "ConversationMessageGenerationTrace"("turnId", "createdAt");
CREATE INDEX "ConversationMessageGenerationTrace_rootUserMessageId_idx" ON "ConversationMessageGenerationTrace"("rootUserMessageId");

CREATE TABLE "ConversationMessagePromptSectionTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationTraceId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sectionKind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceRevisionId" TEXT,
    "contentHash" TEXT NOT NULL,
    "compactUsed" BOOLEAN NOT NULL,
    "placement" TEXT NOT NULL,
    "conversationRole" TEXT,
    "finalProviderRole" TEXT,
    "tokenEstimate" INTEGER NOT NULL,
    "included" BOOLEAN NOT NULL,
    "excludedReason" TEXT,
    CONSTRAINT "ConversationMessagePromptSectionTrace_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "ConversationMessageGenerationTrace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversationMessagePromptSectionTrace_generationTraceId_sectionId_key" ON "ConversationMessagePromptSectionTrace"("generationTraceId", "sectionId");
CREATE INDEX "ConversationMessagePromptSectionTrace_sourceType_sourceId_idx" ON "ConversationMessagePromptSectionTrace"("sourceType", "sourceId");

CREATE TABLE "CompanionGenerationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultMessageId" TEXT,
    "errorCode" TEXT,
    "baseVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CompanionGenerationRequest_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionGenerationRequest_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "CompanionTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionGenerationRequest_resultMessageId_fkey" FOREIGN KEY ("resultMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanionGenerationRequest_companionId_requestId_key" ON "CompanionGenerationRequest"("companionId", "requestId");
CREATE INDEX "CompanionGenerationRequest_companionId_status_idx" ON "CompanionGenerationRequest"("companionId", "status");
CREATE INDEX "CompanionGenerationRequest_turnId_idx" ON "CompanionGenerationRequest"("turnId");

CREATE TABLE "CompanionGenerationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRequestId" TEXT NOT NULL,
    "attemptIndex" INTEGER NOT NULL,
    "modelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promptSnapshotHash" TEXT,
    "capabilitiesSnapshotJson" TEXT,
    "modelParametersJson" TEXT,
    "emittedDelta" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CompanionGenerationAttempt_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "CompanionGenerationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanionGenerationAttempt_generationRequestId_attemptIndex_key" ON "CompanionGenerationAttempt"("generationRequestId", "attemptIndex");
CREATE INDEX "CompanionGenerationAttempt_modelId_status_idx" ON "CompanionGenerationAttempt"("modelId", "status");

CREATE TABLE "CompanionMessageGenerationTrace" (
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
    CONSTRAINT "CompanionMessageGenerationTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CompanionMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_generationRequestId_fkey" FOREIGN KEY ("generationRequestId") REFERENCES "CompanionGenerationRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "CompanionTurn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_requestUserMessageId_fkey" FOREIGN KEY ("requestUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionMessageGenerationTrace_rootUserMessageId_fkey" FOREIGN KEY ("rootUserMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanionMessageGenerationTrace_messageId_key" ON "CompanionMessageGenerationTrace"("messageId");
CREATE UNIQUE INDEX "CompanionMessageGenerationTrace_generationRequestId_key" ON "CompanionMessageGenerationTrace"("generationRequestId");
CREATE INDEX "CompanionMessageGenerationTrace_turnId_createdAt_idx" ON "CompanionMessageGenerationTrace"("turnId", "createdAt");
CREATE INDEX "CompanionMessageGenerationTrace_rootUserMessageId_idx" ON "CompanionMessageGenerationTrace"("rootUserMessageId");
CREATE INDEX "CompanionMessageGenerationTrace_memoryRevisionIdUsed_idx" ON "CompanionMessageGenerationTrace"("memoryRevisionIdUsed");

CREATE TABLE "CompanionMessagePromptSectionTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationTraceId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sectionKind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceRevisionId" TEXT,
    "contentHash" TEXT NOT NULL,
    "compactUsed" BOOLEAN NOT NULL,
    "placement" TEXT NOT NULL,
    "conversationRole" TEXT,
    "finalProviderRole" TEXT,
    "tokenEstimate" INTEGER NOT NULL,
    "included" BOOLEAN NOT NULL,
    "excludedReason" TEXT,
    CONSTRAINT "CompanionMessagePromptSectionTrace_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "CompanionMessageGenerationTrace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanionMessagePromptSectionTrace_generationTraceId_sectionId_key" ON "CompanionMessagePromptSectionTrace"("generationTraceId", "sectionId");
CREATE INDEX "CompanionMessagePromptSectionTrace_sourceType_sourceId_idx" ON "CompanionMessagePromptSectionTrace"("sourceType", "sourceId");
