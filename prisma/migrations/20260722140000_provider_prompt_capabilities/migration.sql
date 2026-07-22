ALTER TABLE "ProviderModel" ADD COLUMN "supportsDeveloperRole" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderModel" ADD COLUMN "systemPlacement" TEXT NOT NULL DEFAULT 'initial_only';
ALTER TABLE "ProviderModel" ADD COLUMN "supportsMultipleSystemMessages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderModel" ADD COLUMN "requiresAlternatingRoles" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProviderModel" ADD COLUMN "tokenizerType" TEXT NOT NULL DEFAULT 'estimated_chars_v1';
