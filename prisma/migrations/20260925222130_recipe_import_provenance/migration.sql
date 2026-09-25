-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "sourceSnapshotJson" TEXT;

-- AlterTable
ALTER TABLE "RecipeDraft" ADD COLUMN "sourceSnapshotJson" TEXT;
