-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityMilli" INTEGER,
    "unit" TEXT NOT NULL,
    "preparation" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "amountKind" TEXT NOT NULL DEFAULT 'measured',
    "originalText" TEXT,
    CONSTRAINT "RecipeIngredient_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RecipeComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecipeIngredient" ("componentId", "id", "ingredientId", "optional", "preparation", "quantityMilli", "unit") SELECT "componentId", "id", "ingredientId", "optional", "preparation", "quantityMilli", "unit" FROM "RecipeIngredient";
DROP TABLE "RecipeIngredient";
ALTER TABLE "new_RecipeIngredient" RENAME TO "RecipeIngredient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
