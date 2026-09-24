-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "generatedRevision" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GroceryList_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroceryList_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroceryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "unitGroup" TEXT NOT NULL,
    "onHandMilli" INTEGER,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GroceryLine_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroceryLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GroceryList_planId_key" ON "GroceryList"("planId");

-- CreateIndex
CREATE INDEX "GroceryList_householdId_idx" ON "GroceryList"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryLine_listId_ingredientId_unitGroup_key" ON "GroceryLine"("listId", "ingredientId", "unitGroup");
