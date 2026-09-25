-- CreateTable
CREATE TABLE "RecipeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "currentRecipeId" TEXT,
    "archivedAt" DATETIME,
    "includeInPlanning" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipeEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "entryId" TEXT,
    "basedOnRecipeId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipeDraft_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeDraft_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RecipeEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdPreferences" (
    "householdId" TEXT NOT NULL PRIMARY KEY,
    "dinnerCount" INTEGER NOT NULL DEFAULT 6,
    "lunchCount" INTEGER NOT NULL DEFAULT 2,
    "maxDinnerMinutes" INTEGER NOT NULL DEFAULT 60,
    "varietyPreference" TEXT NOT NULL DEFAULT 'balanced',
    "exclusionsJson" TEXT NOT NULL DEFAULT '[]',
    "includePrototypeRecipes" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "HouseholdPreferences_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HouseholdPreferences" ("dinnerCount", "exclusionsJson", "householdId", "lunchCount", "maxDinnerMinutes", "varietyPreference") SELECT "dinnerCount", "exclusionsJson", "householdId", "lunchCount", "maxDinnerMinutes", "varietyPreference" FROM "HouseholdPreferences";
DROP TABLE "HouseholdPreferences";
ALTER TABLE "new_HouseholdPreferences" RENAME TO "HouseholdPreferences";
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
    "entryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recipe_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RecipeEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recipe" ("activeMinutes", "baseServings", "contentHash", "createdAt", "id", "recipeKey", "reviewStatus", "role", "sourceAttribution", "sourceUrl", "summary", "title", "totalMinutes", "version") SELECT "activeMinutes", "baseServings", "contentHash", "createdAt", "id", "recipeKey", "reviewStatus", "role", "sourceAttribution", "sourceUrl", "summary", "title", "totalMinutes", "version" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_recipeKey_version_key" ON "Recipe"("recipeKey", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RecipeEntry_recipeKey_key" ON "RecipeEntry"("recipeKey");

-- CreateIndex
CREATE INDEX "RecipeEntry_householdId_idx" ON "RecipeEntry"("householdId");

-- CreateIndex
CREATE INDEX "RecipeDraft_householdId_idx" ON "RecipeDraft"("householdId");
