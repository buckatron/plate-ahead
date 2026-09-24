-- CreateTable
CREATE TABLE "CookingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "servingsServed" INTEGER NOT NULL,
    "cookedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CookingEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CookingEvent_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PlanSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CookingEvent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeftoverBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cookingEventId" TEXT NOT NULL,
    "recipeComponentId" TEXT NOT NULL,
    "quantityMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'fridge',
    "storedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftoverBatch_cookingEventId_fkey" FOREIGN KEY ("cookingEventId") REFERENCES "CookingEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeftoverBatch_recipeComponentId_fkey" FOREIGN KEY ("recipeComponentId") REFERENCES "RecipeComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CookingEvent_slotId_key" ON "CookingEvent"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "CookingEvent_householdId_requestId_key" ON "CookingEvent"("householdId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "LeftoverBatch_cookingEventId_recipeComponentId_key" ON "LeftoverBatch"("cookingEventId", "recipeComponentId");
