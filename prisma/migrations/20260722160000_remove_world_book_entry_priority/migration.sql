-- WorldBook V2 uses immutable revision config.budgetPriority/sortOrder as the
-- single ordering contract. Remove the legacy mutable priority column.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_WorldBookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldBookId" TEXT NOT NULL,
    "activeRevisionId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "secondaryKeywordsJson" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'before_history',
    "tokenBudget" INTEGER,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WorldBookEntry_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookEntry_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "WorldBookEntryRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_WorldBookEntry" (
    "caseSensitive", "content", "createdAt", "deletedAt", "id", "isEnabled",
    "keywordsJson", "metadataJson", "position", "secondaryKeywordsJson", "title",
    "tokenBudget", "updatedAt", "worldBookId", "activeRevisionId"
)
SELECT
    "caseSensitive", "content", "createdAt", "deletedAt", "id", "isEnabled",
    "keywordsJson", "metadataJson", "position", "secondaryKeywordsJson", "title",
    "tokenBudget", "updatedAt", "worldBookId", "activeRevisionId"
FROM "WorldBookEntry";

DROP TABLE "WorldBookEntry";
ALTER TABLE "new_WorldBookEntry" RENAME TO "WorldBookEntry";
CREATE UNIQUE INDEX "WorldBookEntry_activeRevisionId_key" ON "WorldBookEntry"("activeRevisionId");
CREATE INDEX "WorldBookEntry_worldBookId_isEnabled_idx" ON "WorldBookEntry"("worldBookId", "isEnabled");
CREATE INDEX "WorldBookEntry_deletedAt_idx" ON "WorldBookEntry"("deletedAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
