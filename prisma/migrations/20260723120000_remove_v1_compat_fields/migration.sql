-- Context Engine V2 is the only persisted contract. Existing deployments have
-- already migrated their active data; remove the parallel V1 columns instead
-- of keeping fallback or dual-write paths.
ALTER TABLE "Character" DROP COLUMN "description";
ALTER TABLE "Character" DROP COLUMN "scenario";

ALTER TABLE "UserPersona" DROP COLUMN "content";

ALTER TABLE "Companion" DROP COLUMN "identityPrompt";

ALTER TABLE "PromptPreset" DROP COLUMN "systemPrompt";
ALTER TABLE "PromptPreset" DROP COLUMN "outputRules";

ALTER TABLE "WorldBookEntry" DROP COLUMN "title";
ALTER TABLE "WorldBookEntry" DROP COLUMN "content";
ALTER TABLE "WorldBookEntry" DROP COLUMN "keywordsJson";
ALTER TABLE "WorldBookEntry" DROP COLUMN "secondaryKeywordsJson";
ALTER TABLE "WorldBookEntry" DROP COLUMN "position";
ALTER TABLE "WorldBookEntry" DROP COLUMN "tokenBudget";
ALTER TABLE "WorldBookEntry" DROP COLUMN "caseSensitive";
ALTER TABLE "WorldBookEntry" DROP COLUMN "metadataJson";
