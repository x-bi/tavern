-- Add manual sensitive-resource flags. Existing rows use the non-sensitive default.
ALTER TABLE "Character" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PromptPreset" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPersona" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorldBook" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "usesSensitiveResource" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Character_userId_isSensitive_idx" ON "Character"("userId", "isSensitive");
CREATE INDEX "PromptPreset_userId_isSensitive_idx" ON "PromptPreset"("userId", "isSensitive");
CREATE INDEX "UserPersona_userId_isSensitive_idx" ON "UserPersona"("userId", "isSensitive");
CREATE INDEX "WorldBook_userId_isSensitive_idx" ON "WorldBook"("userId", "isSensitive");
CREATE INDEX "Conversation_userId_usesSensitiveResource_idx" ON "Conversation"("userId", "usesSensitiveResource");
