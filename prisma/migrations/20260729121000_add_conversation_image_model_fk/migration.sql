PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "modelFallbackGroupId" TEXT,
  "imageModelFallbackGroupId" TEXT,
  "imageGenerationConfigJson" TEXT,
  "promptPresetId" TEXT,
  "personaId" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 0,
  "activeGenerationLeaseId" TEXT,
  "metadataJson" TEXT,
  "usesSensitiveResource" BOOLEAN NOT NULL DEFAULT false,
  "lastMessageAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME,
  CONSTRAINT "Conversation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Conversation_modelFallbackGroupId_fkey" FOREIGN KEY ("modelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Conversation_imageModelFallbackGroupId_fkey" FOREIGN KEY ("imageModelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Conversation_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "UserPersona" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Conversation_promptPresetId_fkey" FOREIGN KEY ("promptPresetId") REFERENCES "PromptPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Conversation" (
  "id", "userId", "characterId", "modelFallbackGroupId", "imageModelFallbackGroupId",
  "imageGenerationConfigJson", "promptPresetId", "personaId", "title", "status", "version",
  "activeGenerationLeaseId", "metadataJson", "usesSensitiveResource", "lastMessageAt",
  "createdAt", "updatedAt", "deletedAt"
)
SELECT
  "id", "userId", "characterId", "modelFallbackGroupId", "imageModelFallbackGroupId",
  "imageGenerationConfigJson", "promptPresetId", "personaId", "title", "status", "version",
  "activeGenerationLeaseId", "metadataJson", "usesSensitiveResource", "lastMessageAt",
  "createdAt", "updatedAt", "deletedAt"
FROM "Conversation";

DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";

CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
CREATE INDEX "Conversation_userId_usesSensitiveResource_idx" ON "Conversation"("userId", "usesSensitiveResource");
CREATE INDEX "Conversation_characterId_updatedAt_idx" ON "Conversation"("characterId", "updatedAt");
CREATE INDEX "Conversation_modelFallbackGroupId_idx" ON "Conversation"("modelFallbackGroupId");
CREATE INDEX "Conversation_imageModelFallbackGroupId_idx" ON "Conversation"("imageModelFallbackGroupId");
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");
CREATE INDEX "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
