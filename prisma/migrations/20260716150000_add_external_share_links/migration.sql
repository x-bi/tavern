CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "conversationId" TEXT,
    "companionId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'chat',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" DATETIME,
    "lastAccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "ShareLink_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareLink_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareLink_target_check" CHECK (("targetType" = 'conversation' AND "conversationId" IS NOT NULL AND "companionId" IS NULL) OR ("targetType" = 'companion' AND "companionId" IS NOT NULL AND "conversationId" IS NULL)),
    CONSTRAINT "ShareLink_permission_check" CHECK ("permission" IN ('chat', 'readonly')),
    CONSTRAINT "ShareLink_status_check" CHECK ("status" IN ('active', 'revoked'))
);
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");
CREATE INDEX "ShareLink_ownerUserId_createdAt_idx" ON "ShareLink"("ownerUserId", "createdAt");
CREATE INDEX "ShareLink_conversationId_status_idx" ON "ShareLink"("conversationId", "status");
CREATE INDEX "ShareLink_companionId_status_idx" ON "ShareLink"("companionId", "status");
CREATE INDEX "ShareLink_status_expiresAt_idx" ON "ShareLink"("status", "expiresAt");
