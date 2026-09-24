-- AlterTable
ALTER TABLE "PlanSlot" ADD COLUMN "consumptionRequestId" TEXT;

-- CreateTable
CREATE TABLE "LeftoverMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "destinationSlotId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'consume',
    "quantityMilli" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftoverMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeftoverBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeftoverMovement_destinationSlotId_fkey" FOREIGN KEY ("destinationSlotId") REFERENCES "PlanSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LeftoverMovement_destinationSlotId_idx" ON "LeftoverMovement"("destinationSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "LeftoverMovement_batchId_destinationSlotId_key" ON "LeftoverMovement"("batchId", "destinationSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "LeftoverMovement_batchId_requestId_key" ON "LeftoverMovement"("batchId", "requestId");
