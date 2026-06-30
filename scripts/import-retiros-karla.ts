// scripts/import-retiros-karla.ts
// Importa el Excel "Retiros FULL Karla del Rio" a la base:
//   - Usuario Karla (USER_MP, org Mercado Pago)
//   - 2 almacenes FULL  -> warehouses
//   - productos (dedup por nombre)
//   - 2 colectas (una por hoja/retiro) con sus items
//   - inventario (InventoryItem = Total Entregado) + StockMovement ENTRY de auditoría
//
// Idempotente: se puede correr varias veces sin duplicar.
// Uso:
//   DATABASE_URL="<unpooled>" npx tsx scripts/import-retiros-karla.ts --dry-run
//   DATABASE_URL="<unpooled>" npx tsx scripts/import-retiros-karla.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry-run");

type Row = {
  producto: string;
  sku: string | null;
  piezas: number | null;
  totalEntregado: number;
  quienRecibe: string | null;
};
type Sheet = {
  retiro: string;
  warehouse: string;
  clienteNombre: string;
  status: string;
  rows: Row[];
};
type Data = {
  user: { name: string; email: string; password: string; role: string };
  organizationSlug: string;
  sheets: Sheet[];
};

const data: Data = JSON.parse(
  readFileSync(join(__dirname, "retiros-karla.data.json"), "utf-8")
);

// cantidad del item = Piezas si existe, si no Total Entregado
const itemQty = (r: Row) => (r.piezas != null ? r.piezas : r.totalEntregado);

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(DRY ? "🔍 DRY-RUN (sin escribir)\n" : "✍️  IMPORTANDO (escribe en la base)\n");

  const org = await prisma.organization.findUnique({
    where: { slug: data.organizationSlug },
  });
  if (!org) throw new Error(`No existe la organización slug="${data.organizationSlug}". Corre el seed primero.`);
  console.log("Organización:", org.name, `(${org.id})`);

  // ---- Usuario Karla ----
  const existingUser = await prisma.user.findUnique({ where: { email: data.user.email } });
  console.log(
    `\nUsuario ${data.user.email}: ${existingUser ? "YA EXISTE (se conserva)" : "se CREARÁ"} -> ${data.user.name} / ${data.user.role}`
  );
  let userId = existingUser?.id ?? "";
  if (!DRY && !existingUser) {
    const password = await bcrypt.hash(data.user.password, 10);
    const u = await prisma.user.create({
      data: {
        email: data.user.email,
        password,
        name: data.user.name,
        role: data.user.role,
        organizationId: org.id,
      },
    });
    userId = u.id;
    console.log("  ✅ usuario creado:", u.email);
  }
  if (!DRY && !userId) userId = existingUser!.id;
  // En dry-run sin usuario aún, usamos placeholder solo para el reporte.
  if (DRY && !userId) userId = "(se creará)";

  // ---- Productos (dedup por nombre) ----
  const allNames = [...new Set(data.sheets.flatMap((s) => s.rows.map((r) => r.producto)))];
  const productIdByName = new Map<string, string>();
  let prodCreated = 0;
  for (const name of allNames) {
    const sku = data.sheets.flatMap((s) => s.rows).find((r) => r.producto === name)?.sku ?? null;
    const found = await prisma.product.findFirst({ where: { name, organizationId: org.id } });
    if (found) {
      productIdByName.set(name, found.id);
    } else {
      prodCreated++;
      if (!DRY) {
        const p = await prisma.product.create({
          data: { name, sku, unit: "pza", organizationId: org.id },
        });
        productIdByName.set(name, p.id);
      } else {
        productIdByName.set(name, "(se creará)");
      }
    }
  }
  console.log(`\nProductos: ${allNames.length} únicos | nuevos a crear: ${prodCreated} | existentes: ${allNames.length - prodCreated}`);

  // ---- Por hoja: warehouse + colecta + items + inventario ----
  for (const sheet of data.sheets) {
    console.log(`\n=== Hoja: ${sheet.warehouse} (retiro ${sheet.retiro}) — ${sheet.rows.length} productos ===`);

    // Warehouse
    let wh = await prisma.warehouse.findFirst({ where: { name: sheet.warehouse, organizationId: org.id } });
    console.log(`  Almacén "${sheet.warehouse}": ${wh ? "existe" : "se CREARÁ"}`);
    if (!DRY && !wh) {
      wh = await prisma.warehouse.create({ data: { name: sheet.warehouse, organizationId: org.id } });
    }
    const warehouseId = wh?.id ?? "(se creará)";

    // Colecta (upsert por folio+org)
    const existingCol = await prisma.colecta.findUnique({
      where: { folio_organizationId: { folio: sheet.retiro, organizationId: org.id } },
    });
    console.log(`  Colecta folio ${sheet.retiro}: ${existingCol ? "YA EXISTE (se actualizan items)" : "se CREARÁ"} | status ${sheet.status}`);

    const itemsSummary = sheet.rows.map((r) => ({ name: r.producto, qty: itemQty(r), inv: r.totalEntregado }));
    const totalItemQty = itemsSummary.reduce((a, b) => a + b.qty, 0);
    const totalInv = itemsSummary.reduce((a, b) => a + b.inv, 0);
    console.log(`  Items: ${sheet.rows.length} | suma cantidad=${totalItemQty} | suma inventario(Total Entregado)=${totalInv}`);

    if (DRY) {
      for (const it of itemsSummary.slice(0, 3)) console.log(`     · ${it.qty}x ${it.name.slice(0, 50)} (inv ${it.inv})`);
      if (itemsSummary.length > 3) console.log(`     · ... +${itemsSummary.length - 3} más`);
      continue;
    }

    // crear/actualizar colecta
    const colecta = existingCol
      ? await prisma.colecta.update({
          where: { id: existingCol.id },
          data: {
            warehouseId,
            status: sheet.status,
            clienteNombre: sheet.clienteNombre,
            numeroColecta: sheet.retiro,
            metodoEntrega: "RETIRO_FULL",
          },
        })
      : await prisma.colecta.create({
          data: {
            folio: sheet.retiro,
            numeroColecta: sheet.retiro,
            status: sheet.status,
            metodoEntrega: "RETIRO_FULL",
            clienteNombre: sheet.clienteNombre,
            organizationId: org.id,
            warehouseId,
            createdById: userId,
          },
        });

    // items idempotentes: borrar y recrear
    await prisma.colectaItem.deleteMany({ where: { colectaId: colecta.id } });
    // movimientos de import previos de este retiro: limpiar para no duplicar
    const importReason = `Importación retiro ${sheet.retiro}`;
    await prisma.stockMovement.deleteMany({ where: { reason: importReason } });

    for (const r of sheet.rows) {
      const productId = productIdByName.get(r.producto)!;
      await prisma.colectaItem.create({
        data: { colectaId: colecta.id, productId, quantity: itemQty(r) },
      });
      // inventario = Total Entregado (set absoluto)
      await prisma.inventoryItem.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantity: r.totalEntregado },
        create: { productId, warehouseId, quantity: r.totalEntregado },
      });
      // movimiento de auditoría (solo si recibió algo)
      if (r.totalEntregado > 0) {
        await prisma.stockMovement.create({
          data: {
            type: "ENTRY",
            productId,
            toWarehouseId: warehouseId,
            quantity: r.totalEntregado,
            reason: importReason,
            receiverName: r.quienRecibe ?? sheet.clienteNombre,
            createdById: userId,
          },
        });
      }
    }
    console.log(`  ✅ colecta ${colecta.folio} con ${sheet.rows.length} items, inventario y movimientos`);
  }

  console.log(DRY ? "\n🔍 Dry-run terminado. Nada se escribió." : "\n✅ Importación completada.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
