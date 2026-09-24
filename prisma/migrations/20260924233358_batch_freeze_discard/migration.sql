-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeftoverMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "destinationSlotId" TEXT,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'consume',
    "quantityMilli" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftoverMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeftoverBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeftoverMovement_destinationSlotId_fkey" FOREIGN KEY ("destinationSlotId") REFERENCES "PlanSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LeftoverMovement" ("batchId", "destinationSlotId", "id", "quantityMilli", "recordedAt", "requestId", "type") SELECT "batchId", "destinationSlotId", "id", "quantityMilli", "recordedAt", "requestId", "type" FROM "LeftoverMovement";
DROP TABLE "LeftoverMovement";
ALTER TABLE "new_LeftoverMovement" RENAME TO "LeftoverMovement";
CREATE INDEX "LeftoverMovement_destinationSlotId_idx" ON "LeftoverMovement"("destinationSlotId");
CREATE UNIQUE INDEX "LeftoverMovement_batchId_destinationSlotId_key" ON "LeftoverMovement"("batchId", "destinationSlotId");
CREATE UNIQUE INDEX "LeftoverMovement_batchId_requestId_key" ON "LeftoverMovement"("batchId", "requestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
