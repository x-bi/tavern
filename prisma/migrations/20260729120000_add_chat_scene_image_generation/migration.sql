ALTER TABLE "ProviderModel" ADD COLUMN "capability" TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE "ModelFallbackGroup" ADD COLUMN "capability" TEXT NOT NULL DEFAULT 'chat';

ALTER TABLE "Conversation" ADD COLUMN "imageModelFallbackGroupId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "imageGenerationConfigJson" TEXT;

CREATE TABLE "ImageGenerationBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT,
  "sourceMessageId" TEXT,
  "requestId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "modelFallbackGroupId" TEXT NOT NULL,
  "providerModelId" TEXT,
  "scenePromptModelId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "stylePreset" TEXT NOT NULL,
  "requestedImageCount" INTEGER NOT NULL,
  "aspectRatio" TEXT NOT NULL,
  "prompt" TEXT,
  "promptHash" TEXT,
  "positivePromptBody" TEXT,
  "negativePrompt" TEXT,
  "sceneSnapshotJson" TEXT,
  "sceneSnapshotHash" TEXT,
  "parametersJson" TEXT,
  "providerMetadataJson" TEXT,
  "sourceMessageContentHash" TEXT NOT NULL,
  "adminSafeSourceSummary" TEXT,
  "scenePromptVersion" TEXT NOT NULL,
  "scenePromptInputHash" TEXT,
  "scenePromptOutputHash" TEXT,
  "promptCompilerVersion" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "cancelRequestedAt" DATETIME,
  "parentBatchId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ImageGenerationBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageGenerationBatch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ImageGenerationBatch_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ImageGenerationBatch_modelFallbackGroupId_fkey" FOREIGN KEY ("modelFallbackGroupId") REFERENCES "ModelFallbackGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ImageGenerationBatch_parentBatchId_fkey" FOREIGN KEY ("parentBatchId") REFERENCES "ImageGenerationBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ImageGenerationLease" (
  "sourceMessageId" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ImageGenerationLease_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImageGenerationBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ImageAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "sourceType" TEXT NOT NULL DEFAULT 'chat_scene_generation',
  "width" INTEGER,
  "height" INTEGER,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ImageAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageAsset_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImageGenerationBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MessageImageLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "imageAssetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "reason" TEXT NOT NULL DEFAULT 'generated',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MessageImageLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageImageLink_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ImageGenerationBatch_userId_requestId_key" ON "ImageGenerationBatch"("userId", "requestId");
CREATE INDEX "ImageGenerationBatch_userId_createdAt_idx" ON "ImageGenerationBatch"("userId", "createdAt");
CREATE INDEX "ImageGenerationBatch_conversationId_sourceMessageId_idx" ON "ImageGenerationBatch"("conversationId", "sourceMessageId");
CREATE INDEX "ImageGenerationBatch_status_createdAt_idx" ON "ImageGenerationBatch"("status", "createdAt");
CREATE INDEX "ImageGenerationBatch_providerModelId_idx" ON "ImageGenerationBatch"("providerModelId");
CREATE INDEX "ImageGenerationBatch_scenePromptModelId_idx" ON "ImageGenerationBatch"("scenePromptModelId");
CREATE UNIQUE INDEX "ImageGenerationLease_batchId_key" ON "ImageGenerationLease"("batchId");
CREATE UNIQUE INDEX "ImageGenerationLease_leaseId_key" ON "ImageGenerationLease"("leaseId");
CREATE INDEX "ImageGenerationLease_expiresAt_idx" ON "ImageGenerationLease"("expiresAt");
CREATE UNIQUE INDEX "ImageAsset_assetId_key" ON "ImageAsset"("assetId");
CREATE INDEX "ImageAsset_userId_createdAt_idx" ON "ImageAsset"("userId", "createdAt");
CREATE INDEX "ImageAsset_batchId_orderIndex_idx" ON "ImageAsset"("batchId", "orderIndex");
CREATE INDEX "ImageAsset_status_createdAt_idx" ON "ImageAsset"("status", "createdAt");
CREATE UNIQUE INDEX "MessageImageLink_messageId_imageAssetId_key" ON "MessageImageLink"("messageId", "imageAssetId");
CREATE INDEX "MessageImageLink_messageId_status_idx" ON "MessageImageLink"("messageId", "status");
CREATE INDEX "MessageImageLink_imageAssetId_status_idx" ON "MessageImageLink"("imageAssetId", "status");
CREATE INDEX "ProviderModel_providerId_capability_idx" ON "ProviderModel"("providerId", "capability");
CREATE INDEX "ModelFallbackGroup_userId_capability_idx" ON "ModelFallbackGroup"("userId", "capability");
CREATE INDEX "Conversation_imageModelFallbackGroupId_idx" ON "Conversation"("imageModelFallbackGroupId");
