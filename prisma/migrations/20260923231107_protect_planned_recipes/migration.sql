-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "mealKind" TEXT NOT NULL,
    "slotType" TEXT NOT NULL,
    "recipeId" TEXT,
    "servings" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'planned',
    CONSTRAINT "PlanSlot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanSlot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlanSlot" ("id", "localDate", "locked", "mealKind", "planId", "recipeId", "servings", "slotType", "status") SELECT "id", "localDate", "locked", "mealKind", "planId", "recipeId", "servings", "slotType", "status" FROM "PlanSlot";
DROP TABLE "PlanSlot";
ALTER TABLE "new_PlanSlot" RENAME TO "PlanSlot";
CREATE UNIQUE INDEX "PlanSlot_planId_localDate_mealKind_key" ON "PlanSlot"("planId", "localDate", "mealKind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
