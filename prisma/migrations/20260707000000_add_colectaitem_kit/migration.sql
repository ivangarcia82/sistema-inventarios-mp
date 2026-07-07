-- AlterTable
ALTER TABLE "ColectaItem" ADD COLUMN     "kitGroupId" TEXT;
ALTER TABLE "ColectaItem" ADD COLUMN     "kitLabel" TEXT;

-- CreateIndex
CREATE INDEX "ColectaItem_kitGroupId_idx" ON "ColectaItem"("kitGroupId");
