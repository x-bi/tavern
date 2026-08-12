CREATE TABLE "QqAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "apiBaseUrl" TEXT NOT NULL,
  "webUiUrl" TEXT,
  "accessTokenCiphertext" TEXT,
  "accessTokenMask" TEXT,
  "qqUin" TEXT,
  "nickname" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastConnectedAt" DATETIME,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "QqAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QqChatBinding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "qqAccountId" TEXT NOT NULL,
  "peerQqUin" TEXT NOT NULL,
  "peerNickname" TEXT,
  "targetType" TEXT NOT NULL,
  "conversationId" TEXT,
  "companionId" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastInboundAt" DATETIME,
  "lastOutboundAt" DATETIME,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "QqChatBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QqChatBinding_qqAccountId_fkey" FOREIGN KEY ("qqAccountId") REFERENCES "QqAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QqChatBinding_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QqChatBinding_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QqChatBinding_target_check" CHECK (("targetType" = 'conversation' AND "conversationId" IS NOT NULL AND "companionId" IS NULL) OR ("targetType" = 'companion' AND "companionId" IS NOT NULL AND "conversationId" IS NULL))
);

CREATE TABLE "QqInboundEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "qqAccountId" TEXT NOT NULL,
  "bindingId" TEXT,
  "externalMessageId" TEXT NOT NULL,
  "peerQqUin" TEXT NOT NULL,
  "content" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" DATETIME,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" DATETIME,
  CONSTRAINT "QqInboundEvent_qqAccountId_fkey" FOREIGN KEY ("qqAccountId") REFERENCES "QqAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QqInboundEvent_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "QqChatBinding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "QqDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bindingId" TEXT NOT NULL,
  "sourceMessageKey" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sentChunkCount" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" DATETIME,
  "externalMessageId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "sentAt" DATETIME,
  CONSTRAINT "QqDelivery_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "QqChatBinding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QqAccount_qqUin_key" ON "QqAccount"("qqUin");
CREATE UNIQUE INDEX "QqAccount_userId_label_key" ON "QqAccount"("userId", "label");
CREATE INDEX "QqAccount_userId_isEnabled_idx" ON "QqAccount"("userId", "isEnabled");
CREATE INDEX "QqAccount_status_updatedAt_idx" ON "QqAccount"("status", "updatedAt");
CREATE UNIQUE INDEX "QqChatBinding_conversationId_key" ON "QqChatBinding"("conversationId");
CREATE UNIQUE INDEX "QqChatBinding_companionId_key" ON "QqChatBinding"("companionId");
CREATE UNIQUE INDEX "QqChatBinding_qqAccountId_peerQqUin_key" ON "QqChatBinding"("qqAccountId", "peerQqUin");
CREATE INDEX "QqChatBinding_userId_isEnabled_idx" ON "QqChatBinding"("userId", "isEnabled");
CREATE INDEX "QqChatBinding_targetType_updatedAt_idx" ON "QqChatBinding"("targetType", "updatedAt");
CREATE UNIQUE INDEX "QqInboundEvent_qqAccountId_externalMessageId_key" ON "QqInboundEvent"("qqAccountId", "externalMessageId");
CREATE INDEX "QqInboundEvent_status_nextRetryAt_receivedAt_idx" ON "QqInboundEvent"("status", "nextRetryAt", "receivedAt");
CREATE INDEX "QqInboundEvent_bindingId_receivedAt_idx" ON "QqInboundEvent"("bindingId", "receivedAt");
CREATE UNIQUE INDEX "QqDelivery_sourceMessageKey_key" ON "QqDelivery"("sourceMessageKey");
CREATE INDEX "QqDelivery_status_nextRetryAt_createdAt_idx" ON "QqDelivery"("status", "nextRetryAt", "createdAt");
CREATE INDEX "QqDelivery_bindingId_createdAt_idx" ON "QqDelivery"("bindingId", "createdAt");
