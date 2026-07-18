-- Replace the single optional WorldBook.characterId with an explicit many-to-many relation.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "WorldBookCharacter" (
    "worldBookId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("worldBookId", "characterId"),
    CONSTRAINT "WorldBookCharacter_worldBookId_fkey" FOREIGN KEY ("worldBookId") REFERENCES "WorldBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldBookCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "WorldBookCharacter" ("worldBookId", "characterId")
SELECT "id", "characterId"
FROM "WorldBook"
WHERE "characterId" IS NOT NULL;

CREATE TABLE "new_WorldBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scanDepth" INTEGER NOT NULL DEFAULT 6,
    "tokenBudget" INTEGER NOT NULL DEFAULT 1000,
    "metadataJson" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "WorldBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_WorldBook" (
    "id", "userId", "name", "description", "isEnabled", "scanDepth", "tokenBudget",
    "metadataJson", "isSensitive", "isShared", "createdAt", "updatedAt", "deletedAt"
)
SELECT
    "id", "userId", "name", "description", "isEnabled", "scanDepth", "tokenBudget",
    "metadataJson", "isSensitive", "isShared", "createdAt", "updatedAt", "deletedAt"
FROM "WorldBook";

DROP TABLE "WorldBook";
ALTER TABLE "new_WorldBook" RENAME TO "WorldBook";

CREATE INDEX "WorldBook_userId_isEnabled_idx" ON "WorldBook"("userId", "isEnabled");
CREATE INDEX "WorldBook_userId_isSensitive_idx" ON "WorldBook"("userId", "isSensitive");
CREATE INDEX "WorldBook_isShared_idx" ON "WorldBook"("isShared");
CREATE INDEX "WorldBook_deletedAt_idx" ON "WorldBook"("deletedAt");
CREATE INDEX "WorldBookCharacter_characterId_idx" ON "WorldBookCharacter"("characterId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
