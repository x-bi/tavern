-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "modelConfigId" TEXT,
    "requestMessageId" TEXT,
    "responseMessageId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestJson" TEXT,
    "responseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelCallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModelCallLog_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModelCallLog_requestMessageId_fkey" FOREIGN KEY ("requestMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModelCallLog_responseMessageId_fkey" FOREIGN KEY ("responseMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModelCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ModelCallLog" ("completionTokens", "conversationId", "createdAt", "errorCode", "errorMessage", "id", "latencyMs", "model", "modelConfigId", "promptTokens", "provider", "requestJson", "requestMessageId", "responseJson", "responseMessageId", "status", "totalTokens", "userId") SELECT "completionTokens", "conversationId", "createdAt", "errorCode", "errorMessage", "id", "latencyMs", "model", "modelConfigId", "promptTokens", "provider", "requestJson", "requestMessageId", "responseJson", "responseMessageId", "status", "totalTokens", "userId" FROM "ModelCallLog";
DROP TABLE "ModelCallLog";
ALTER TABLE "new_ModelCallLog" RENAME TO "ModelCallLog";
CREATE INDEX "ModelCallLog_userId_createdAt_idx" ON "ModelCallLog"("userId", "createdAt");
CREATE INDEX "ModelCallLog_conversationId_idx" ON "ModelCallLog"("conversationId");
CREATE INDEX "ModelCallLog_modelConfigId_idx" ON "ModelCallLog"("modelConfigId");
CREATE INDEX "ModelCallLog_requestMessageId_idx" ON "ModelCallLog"("requestMessageId");
CREATE INDEX "ModelCallLog_responseMessageId_idx" ON "ModelCallLog"("responseMessageId");
CREATE INDEX "ModelCallLog_status_idx" ON "ModelCallLog"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
