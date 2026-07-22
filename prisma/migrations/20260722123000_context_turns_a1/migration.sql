CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "completedOrdinal" INTEGER,
    "userMessageId" TEXT NOT NULL,
    "activeAssistantMessageId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationTurn_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationTurn_activeAssistantMessageId_fkey" FOREIGN KEY ("activeAssistantMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Message" ADD COLUMN "turnId" TEXT REFERENCES "ConversationTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ConversationTurn_userMessageId_key" ON "ConversationTurn"("userMessageId");
CREATE UNIQUE INDEX "ConversationTurn_activeAssistantMessageId_key" ON "ConversationTurn"("activeAssistantMessageId");
CREATE UNIQUE INDEX "ConversationTurn_conversationId_sequence_key" ON "ConversationTurn"("conversationId", "sequence");
CREATE UNIQUE INDEX "ConversationTurn_conversationId_completedOrdinal_key" ON "ConversationTurn"("conversationId", "completedOrdinal");
CREATE INDEX "ConversationTurn_conversationId_status_idx" ON "ConversationTurn"("conversationId", "status");
CREATE INDEX "Message_turnId_idx" ON "Message"("turnId");

CREATE TABLE "CompanionTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "completedOrdinal" INTEGER,
    "userMessageId" TEXT NOT NULL,
    "activeAssistantMessageId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CompanionTurn_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanionTurn_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanionTurn_activeAssistantMessageId_fkey" FOREIGN KEY ("activeAssistantMessageId") REFERENCES "CompanionMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "CompanionMessage" ADD COLUMN "turnId" TEXT REFERENCES "CompanionTurn" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CompanionTurn_userMessageId_key" ON "CompanionTurn"("userMessageId");
CREATE UNIQUE INDEX "CompanionTurn_activeAssistantMessageId_key" ON "CompanionTurn"("activeAssistantMessageId");
CREATE UNIQUE INDEX "CompanionTurn_companionId_sequence_key" ON "CompanionTurn"("companionId", "sequence");
CREATE UNIQUE INDEX "CompanionTurn_companionId_completedOrdinal_key" ON "CompanionTurn"("companionId", "completedOrdinal");
CREATE INDEX "CompanionTurn_companionId_status_idx" ON "CompanionTurn"("companionId", "status");
CREATE INDEX "CompanionMessage_turnId_idx" ON "CompanionMessage"("turnId");
