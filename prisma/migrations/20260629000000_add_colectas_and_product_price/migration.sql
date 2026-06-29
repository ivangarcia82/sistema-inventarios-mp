-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER_MP';

-- CreateTable
CREATE TABLE "Colecta" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "ordenCompra" TEXT,
    "numeroColecta" TEXT,
    "numeroSolicitud" TEXT,
    "metodoEntrega" TEXT NOT NULL DEFAULT 'RECOLECCION',
    "status" TEXT NOT NULL DEFAULT 'CREADA',
    "clienteNombre" TEXT,
    "tallerArrivedAt" TIMESTAMP(3),
    "prepDeadlineAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colecta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColectaItem" (
    "id" TEXT NOT NULL,
    "colectaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ColectaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColectaAviso" (
    "id" TEXT NOT NULL,
    "colectaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColectaAviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Colecta_organizationId_idx" ON "Colecta"("organizationId");

-- CreateIndex
CREATE INDEX "Colecta_status_idx" ON "Colecta"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Colecta_folio_organizationId_key" ON "Colecta"("folio", "organizationId");

-- CreateIndex
CREATE INDEX "ColectaItem_colectaId_idx" ON "ColectaItem"("colectaId");

-- CreateIndex
CREATE INDEX "ColectaAviso_colectaId_idx" ON "ColectaAviso"("colectaId");

-- AddForeignKey
ALTER TABLE "Colecta" ADD CONSTRAINT "Colecta_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colecta" ADD CONSTRAINT "Colecta_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colecta" ADD CONSTRAINT "Colecta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColectaItem" ADD CONSTRAINT "ColectaItem_colectaId_fkey" FOREIGN KEY ("colectaId") REFERENCES "Colecta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColectaItem" ADD CONSTRAINT "ColectaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColectaAviso" ADD CONSTRAINT "ColectaAviso_colectaId_fkey" FOREIGN KEY ("colectaId") REFERENCES "Colecta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColectaAviso" ADD CONSTRAINT "ColectaAviso_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

