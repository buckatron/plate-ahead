/*
  Warnings:

  - You are about to drop the column `dinnerUseMilli` on the `PlannedComponent` table. All the data in the column will be lost.
  - Added the required column `mealUseMilli` to the `PlannedComponent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PlanSlot" ADD COLUMN "reason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "settingsJson" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "generationIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MealPlan" ("createdAt", "householdId", "id", "revision", "settingsJson", "state", "updatedAt", "weekStart") SELECT "createdAt", "householdId", "id", "revision", "settingsJson", "state", "updatedAt", "weekStart" FROM "MealPlan";
DROP TABLE "MealPlan";
ALTER TABLE "new_MealPlan" RENAME TO "MealPlan";
CREATE INDEX "MealPlan_householdId_weekStart_idx" ON "MealPlan"("householdId", "weekStart");
CREATE UNIQUE INDEX "MealPlan_householdId_weekStart_generationIndex_key" ON "MealPlan"("householdId", "weekStart", "generationIndex");
CREATE TABLE "new_PlannedComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT NOT NULL,
    "recipeComponentId" TEXT NOT NULL,
    "preparationMilli" INTEGER NOT NULL,
    "plannedYieldMilli" INTEGER NOT NULL,
    "mealUseMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "PlannedComponent_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PlanSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedComponent_recipeComponentId_fkey" FOREIGN KEY ("recipeComponentId") REFERENCES "RecipeComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlannedComponent" ("id", "plannedYieldMilli", "preparationMilli", "recipeComponentId", "slotId", "unit") SELECT "id", "plannedYieldMilli", "preparationMilli", "recipeComponentId", "slotId", "unit" FROM "PlannedComponent";
DROP TABLE "PlannedComponent";
ALTER TABLE "new_PlannedComponent" RENAME TO "PlannedComponent";
CREATE UNIQUE INDEX "PlannedComponent_slotId_recipeComponentId_key" ON "PlannedComponent"("slotId", "recipeComponentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
