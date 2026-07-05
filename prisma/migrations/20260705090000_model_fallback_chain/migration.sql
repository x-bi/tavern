-- CreateTable
CREATE TABLE "ModelProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseUrl" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT,
    "apiKeyMask" TEXT,
    "timeout" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ModelProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "defaultParamsJson" TEXT,
    "contextLength" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ProviderModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ModelProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelFallbackGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ModelFallbackGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelFallbackCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelFallbackCandidate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModelFallbackCandidate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProviderModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "modelFallbackGroupId" TEXT REFERENCES "ModelFallbackGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate legacy one-model configs into provider/model/group records.
INSERT INTO "ModelProvider" (
    "id",
    "userId",
    "name",
    "provider",
    "baseUrl",
    "apiKeyCiphertext",
    "apiKeyMask",
    "timeout",
    "isDefault",
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'provider_' || "id",
    "userId",
    "name",
    "provider",
    "baseUrl",
    "apiKeyCiphertext",
    "apiKeyMask",
    CAST(json_extract("defaultParamsJson", '$.timeout') AS INTEGER),
    "isDefault",
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
FROM "ModelConfig";

INSERT INTO "ProviderModel" (
    "id",
    "providerId",
    "name",
    "model",
    "defaultParamsJson",
    "sortOrder",
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'model_' || "id",
    'provider_' || "id",
    "model",
    "model",
    "defaultParamsJson",
    0,
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
FROM "ModelConfig";

INSERT INTO "ModelFallbackGroup" (
    "id",
    "userId",
    "name",
    "isDefault",
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'group_' || "id",
    "userId",
    "name" || ' 模型链',
    "isDefault",
    "isEnabled",
    "createdAt",
    "updatedAt",
    "deletedAt"
FROM "ModelConfig";

INSERT INTO "ModelFallbackCandidate" (
    "id",
    "groupId",
    "modelId",
    "priority",
    "isEnabled",
    "createdAt",
    "updatedAt"
)
SELECT
    'candidate_' || "id",
    'group_' || "id",
    'model_' || "id",
    1,
    "isEnabled",
    "createdAt",
    "updatedAt"
FROM "ModelConfig";

UPDATE "Conversation"
SET "modelFallbackGroupId" = 'group_' || "modelConfigId"
WHERE "modelConfigId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_userId_name_key" ON "ModelProvider"("userId", "name");
CREATE INDEX "ModelProvider_userId_isEnabled_idx" ON "ModelProvider"("userId", "isEnabled");
CREATE INDEX "ModelProvider_provider_idx" ON "ModelProvider"("provider");
CREATE INDEX "ModelProvider_deletedAt_idx" ON "ModelProvider"("deletedAt");
CREATE UNIQUE INDEX "ProviderModel_providerId_name_key" ON "ProviderModel"("providerId", "name");
CREATE UNIQUE INDEX "ProviderModel_providerId_model_key" ON "ProviderModel"("providerId", "model");
CREATE INDEX "ProviderModel_providerId_isEnabled_idx" ON "ProviderModel"("providerId", "isEnabled");
CREATE INDEX "ProviderModel_deletedAt_idx" ON "ProviderModel"("deletedAt");
CREATE UNIQUE INDEX "ModelFallbackGroup_userId_name_key" ON "ModelFallbackGroup"("userId", "name");
CREATE INDEX "ModelFallbackGroup_userId_isEnabled_idx" ON "ModelFallbackGroup"("userId", "isEnabled");
CREATE INDEX "ModelFallbackGroup_deletedAt_idx" ON "ModelFallbackGroup"("deletedAt");
CREATE UNIQUE INDEX "ModelFallbackCandidate_groupId_modelId_key" ON "ModelFallbackCandidate"("groupId", "modelId");
CREATE UNIQUE INDEX "ModelFallbackCandidate_groupId_priority_key" ON "ModelFallbackCandidate"("groupId", "priority");
CREATE INDEX "ModelFallbackCandidate_modelId_idx" ON "ModelFallbackCandidate"("modelId");
CREATE INDEX "Conversation_modelFallbackGroupId_idx" ON "Conversation"("modelFallbackGroupId");
