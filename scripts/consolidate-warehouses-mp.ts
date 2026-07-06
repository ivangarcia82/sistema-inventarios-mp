// scripts/consolidate-warehouses-mp.ts
// Deja la organización Mercado Pago con SOLO 2 almacenes:
//   - "Almacén Mercado Pago"  <- recibe TODO el inventario existente (suma stock)
//   - "Almacén GI"            <- se crea vacío (stock que sigue en Generando Ideas)
// Cualquier otro almacén de la org MP (Almacén FULL 1/2, Oficina CDMX/Monterrey, etc.)
// se fusiona hacia "Almacén Mercado Pago" y se elimina.
//
// Preserva el inventario actual (lo suma; no re-lee el Excel). Reasigna movimientos
// y colectas antes de borrar. Idempotente: al re-correr ya no hay almacenes extra.
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/consolidate-warehouses-mp.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/consolidate-warehouses-mp.ts --apply    # escribe
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";
const PRIMARY_NAME = "Almacén Mercado Pago";
const GI_NAME = "Almacén GI";
// Almacenes cuyo contenido se DESCARTA (borra) en vez de fusionarse. Por defecto
// "Oficina CDMX" (solo tiene movimientos de prueba de Karla). Separar por "|".
const DISCARD = (process.env.DISCARD_WAREHOUSES ?? "Oficina CDMX")
  .split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isDiscard = (name: string) => DISCARD.includes(name.trim().toLowerCase());

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function ensureWarehouse(orgId: string, name: string): Promise<string | null> {
  const found = await prisma.warehouse.findFirst({ where: { name, organizationId: orgId } });
  if (found) { console.log(`  Almacén "${name}": existe (${found.id})`); return found.id; }
  if (!APPLY) { console.log(`  Almacén "${name}": se CREARÁ`); return null; }
  const w = await prisma.warehouse.create({ data: { name, organizationId: orgId } });
  console.log(`  ✅ Almacén "${name}" creado (${w.id})`);
  return w.id;
}

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("Organización:", org.name, `(${org.id})\n`);

  console.log("Almacenes objetivo:");
  const primaryId = await ensureWarehouse(org.id, PRIMARY_NAME);
  await ensureWarehouse(org.id, GI_NAME);

  const all = await prisma.warehouse.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } });
  const sources = all.filter((w) => w.name !== PRIMARY_NAME && w.name !== GI_NAME);

  console.log(`\nAlmacenes actuales de la org: ${all.length}`);
  all.forEach((w) => {
    const tag = w.name === PRIMARY_NAME || w.name === GI_NAME
      ? "(se conserva)"
      : isDiscard(w.name)
        ? "(se DESCARTA: borra su contenido)"
        : "(se fusiona y borra)";
    console.log(`   · ${w.name}  ${tag}`);
  });

  if (sources.length === 0) {
    console.log("\n✅ Ya está consolidado: no hay almacenes extra.");
    await done();
    return;
  }

  for (const src of sources) {
    const discard = isDiscard(src.name);
    console.log(`\n=== ${discard ? "DESCARTANDO" : "Fusionando"} "${src.name}" (${src.id})${discard ? "" : ` -> "${PRIMARY_NAME}"`} ===`);
    const items = await prisma.inventoryItem.findMany({
      where: { warehouseId: src.id },
      include: { product: { select: { name: true } } },
    });
    const movFrom = await prisma.stockMovement.count({ where: { fromWarehouseId: src.id } });
    const movTo = await prisma.stockMovement.count({ where: { toWarehouseId: src.id } });
    const cols = await prisma.colecta.count({ where: { warehouseId: src.id } });
    const totalQty = items.reduce((a, b) => a + b.quantity, 0);
    console.log(`  Inventario: ${items.length} productos (stock=${totalQty}) | movimientos from=${movFrom} to=${movTo} | colectas=${cols}`);
    items.slice(0, 5).forEach((i) => console.log(`     · ${i.quantity} x ${i.product.name.slice(0, 55)}`));
    if (items.length > 5) console.log(`     · ... +${items.length - 5} más`);
    if (discard) console.log(`  ⚠️  Se BORRARÁN su inventario, ${movFrom + movTo} movimiento(s) y ${cols} colecta(s) (datos de prueba).`);

    if (!APPLY) continue;
    if (!primaryId) throw new Error("primaryId nulo en modo apply");

    if (discard) {
      // Borrar TODO lo del almacén de prueba (no se fusiona nada).
      await prisma.colecta.deleteMany({ where: { warehouseId: src.id } }); // cascade: items + avisos
      await prisma.stockMovement.deleteMany({ where: { OR: [{ fromWarehouseId: src.id }, { toWarehouseId: src.id }] } });
      await prisma.inventoryItem.deleteMany({ where: { warehouseId: src.id } });
      await prisma.warehouse.delete({ where: { id: src.id } });
      console.log(`  🗑️  "${src.name}" descartado y eliminado.`);
      continue;
    }

    // 1) Inventario: sumar hacia el primario, luego borrar el del origen.
    for (const it of items) {
      await prisma.inventoryItem.upsert({
        where: { productId_warehouseId: { productId: it.productId, warehouseId: primaryId } },
        update: { quantity: { increment: it.quantity } },
        create: { productId: it.productId, warehouseId: primaryId, quantity: it.quantity },
      });
      await prisma.inventoryItem.delete({ where: { id: it.id } });
    }
    // 2) Reasignar movimientos y colectas.
    await prisma.stockMovement.updateMany({ where: { fromWarehouseId: src.id }, data: { fromWarehouseId: primaryId } });
    await prisma.stockMovement.updateMany({ where: { toWarehouseId: src.id }, data: { toWarehouseId: primaryId } });
    await prisma.colecta.updateMany({ where: { warehouseId: src.id }, data: { warehouseId: primaryId } });
    // 3) Borrar el almacén origen.
    await prisma.warehouse.delete({ where: { id: src.id } });
    console.log(`  ✅ "${src.name}" fusionado y eliminado.`);
  }

  // Reporte final del primario.
  if (APPLY && primaryId) {
    const finalItems = await prisma.inventoryItem.aggregate({ where: { warehouseId: primaryId }, _sum: { quantity: true }, _count: true });
    console.log(`\n✅ "${PRIMARY_NAME}" ahora tiene ${finalItems._count} productos, stock total ${finalItems._sum.quantity ?? 0}.`);
    const remaining = await prisma.warehouse.findMany({ where: { organizationId: org.id }, orderBy: { name: "asc" } });
    console.log("Almacenes finales de la org:", remaining.map((w) => w.name).join(" | "));
  }

  console.log(APPLY ? "\n✅ Consolidación completada." : "\n🔍 Dry-run terminado. Nada se escribió.");
  await done();
}

async function done() {
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
