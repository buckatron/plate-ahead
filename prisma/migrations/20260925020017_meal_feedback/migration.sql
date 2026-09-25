-- CreateTable
CREATE TABLE "MealFeedback" (
    "cookingEventId" TEXT NOT NULL PRIMARY KEY,
    "reaction" TEXT,
    "effort" TEXT,
    "leftovers" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealFeedback_cookingEventId_fkey" FOREIGN KEY ("cookingEventId") REFERENCES "CookingEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
