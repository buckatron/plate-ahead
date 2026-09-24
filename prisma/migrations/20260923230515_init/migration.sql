-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "servings" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HouseholdPreferences" (
    "householdId" TEXT NOT NULL PRIMARY KEY,
    "dinnerCount" INTEGER NOT NULL DEFAULT 6,
    "lunchCount" INTEGER NOT NULL DEFAULT 2,
    "maxDinnerMinutes" INTEGER NOT NULL DEFAULT 60,
    "varietyPreference" TEXT NOT NULL DEFAULT 'balanced',
    "exclusionsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "HouseholdPreferences_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groceryCategory" TEXT NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "aliasesJson" TEXT NOT NULL DEFAULT '[]',
    "packageMilli" INTEGER,
    "packageUnit" TEXT
);

-- CreateTable
CREATE TABLE "HouseholdIngredient" (
    "householdId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityMilli" INTEGER,
    "unit" TEXT,
    "isStaple" BOOLEAN NOT NULL DEFAULT false,
    "useFirst" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" DATETIME,

    PRIMARY KEY ("householdId", "ingredientId"),
    CONSTRAINT "HouseholdIngredient_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RecipeTag" (
    "recipeId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    PRIMARY KEY ("recipeId", "dimension", "value"),
    CONSTRAINT "RecipeTag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseYieldMilli" INTEGER NOT NULL,
    "yieldUnit" TEXT NOT NULL,
    "reservable" BOOLEAN NOT NULL DEFAULT false,
    "preparation" TEXT NOT NULL,
    "storageGuidance" TEXT,
    "storageSourceUrl" TEXT,
    CONSTRAINT "RecipeComponent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "preparation" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecipeIngredient_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RecipeComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "recipeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "componentId" TEXT,

    PRIMARY KEY ("recipeId", "sequence"),
    CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeStep_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RecipeComponent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transformation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceComponentId" TEXT NOT NULL,
    "targetRecipeKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "compatibleState" TEXT NOT NULL,
    "storageGuidance" TEXT,
    "storageSourceUrl" TEXT,
    CONSTRAINT "Transformation_sourceComponentId_fkey" FOREIGN KEY ("sourceComponentId") REFERENCES "RecipeComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransformationInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transformationId" TEXT NOT NULL,
    "targetComponentId" TEXT NOT NULL,
    "requiredMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "TransformationInput_transformationId_fkey" FOREIGN KEY ("transformationId") REFERENCES "Transformation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransformationInput_targetComponentId_fkey" FOREIGN KEY ("targetComponentId") REFERENCES "RecipeComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "settingsJson" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanSlot" (
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
    CONSTRAINT "PlanSlot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannedComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT NOT NULL,
    "recipeComponentId" TEXT NOT NULL,
    "preparationMilli" INTEGER NOT NULL,
    "plannedYieldMilli" INTEGER NOT NULL,
    "dinnerUseMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "PlannedComponent_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PlanSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedComponent_recipeComponentId_fkey" FOREIGN KEY ("recipeComponentId") REFERENCES "RecipeComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceComponentId" TEXT NOT NULL,
    "destinationSlotId" TEXT NOT NULL,
    "transformationId" TEXT NOT NULL,
    "reservedMilli" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'planned',
    CONSTRAINT "ComponentAllocation_sourceComponentId_fkey" FOREIGN KEY ("sourceComponentId") REFERENCES "PlannedComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentAllocation_destinationSlotId_fkey" FOREIGN KEY ("destinationSlotId") REFERENCES "PlanSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentAllocation_transformationId_fkey" FOREIGN KEY ("transformationId") REFERENCES "Transformation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_recipeKey_version_key" ON "Recipe"("recipeKey", "version");

-- CreateIndex
CREATE INDEX "MealPlan_householdId_weekStart_idx" ON "MealPlan"("householdId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSlot_planId_localDate_mealKind_key" ON "PlanSlot"("planId", "localDate", "mealKind");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedComponent_slotId_recipeComponentId_key" ON "PlannedComponent"("slotId", "recipeComponentId");

-- CreateIndex
CREATE INDEX "ComponentAllocation_destinationSlotId_idx" ON "ComponentAllocation"("destinationSlotId");
