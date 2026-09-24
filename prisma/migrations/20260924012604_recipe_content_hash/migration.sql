-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "baseServings" INTEGER NOT NULL,
    "activeMinutes" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "sourceAttribution" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'draft',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Recipe" ("activeMinutes", "baseServings", "createdAt", "id", "recipeKey", "reviewStatus", "role", "sourceAttribution", "sourceUrl", "summary", "title", "totalMinutes", "version") SELECT "activeMinutes", "baseServings", "createdAt", "id", "recipeKey", "reviewStatus", "role", "sourceAttribution", "sourceUrl", "summary", "title", "totalMinutes", "version" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_recipeKey_version_key" ON "Recipe"("recipeKey", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
