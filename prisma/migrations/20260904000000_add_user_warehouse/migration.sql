-- Almacén asignado por usuario: si está definido, el usuario solo ve ese almacén.
ALTER TABLE "User" ADD COLUMN "warehouseId" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_warehouseId_idx" ON "User"("warehouseId");
