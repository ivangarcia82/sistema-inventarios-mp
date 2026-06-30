-- AlterTable: el default del tipo de colecta pasa de RECOLECCION a RETIRO_FULL
ALTER TABLE "Colecta" ALTER COLUMN "metodoEntrega" SET DEFAULT 'RETIRO_FULL';

-- Data: el valor antiguo "RECOLECCION" se renombró a "RETIRO_FULL"
UPDATE "Colecta" SET "metodoEntrega" = 'RETIRO_FULL' WHERE "metodoEntrega" = 'RECOLECCION';

