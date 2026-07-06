-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "piecesPerUnit" INTEGER NOT NULL DEFAULT 1;
