-- AlterTable
ALTER TABLE "Character" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PromptPreset" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserPersona" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorldBook" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Companion" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Companion" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Character_isShared_idx" ON "Character"("isShared");

-- CreateIndex
CREATE INDEX "PromptPreset_isShared_idx" ON "PromptPreset"("isShared");

-- CreateIndex
CREATE INDEX "UserPersona_isShared_idx" ON "UserPersona"("isShared");

-- CreateIndex
CREATE INDEX "WorldBook_isShared_idx" ON "WorldBook"("isShared");

-- CreateIndex
CREATE INDEX "Companion_userId_isSensitive_idx" ON "Companion"("userId", "isSensitive");

-- CreateIndex
CREATE INDEX "Companion_isShared_idx" ON "Companion"("isShared");
