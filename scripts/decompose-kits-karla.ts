// scripts/decompose-kits-karla.ts
// Desglosa los "Kit Para Representantes" en sus piezas individuales, según la
// hoja "Desgloce 7226075" del Excel de la clienta. Cada kit (talla) se convierte en:
//   1 Mochila + 1 Gorra + 2 Lanyard + 1 Playera (producto SEPARADO por talla).
// El inventario del kit pasa a las piezas y el producto kit queda en 0 (se conserva
// para el historial de retiros/colectas).
//
// Piezas nuevas (nombres y costos según Desgloce/COSTOS):
//   Mochila $335 | Gorra $69.50 | Lanyard $35 | Playera (por talla) $249.50
// Las playeras de kit son productos SEPARADOS de las "Playera Dry-fit ..." sueltas.
//
// Idempotente: marca cada kit con un StockMovement de desglose; si ya existe, lo omite.
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/decompose-kits-karla.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/decompose-kits-karla.ts --apply    # escribe
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";
const MARKER = "Desglose de kit → piezas";

// Costos por componente (Excel COSTOS)
const COST = { mochila: 335, gorra: 69.5, lanyard: 35, playera: 249.5 };

// Talla del kit -> nombre del producto de playera (hoja "Desgloce 7226075")
const PLAYERA_NAME: Record<string, string> = {
  "HOMBRE|G": "Playera Hombre Grande",
  "HOMBRE|M": "Playera Hombre Mediana",
  "HOMBRE|S": "Playera Hombre Chica",
  "HOMBRE|XL": "Playera Hombre Grande XL",
  "MUJER|G": "Playera Mujer Grande",
  "MUJER|M": "Playera Mujer Mediana",
  "MUJER|S": "Playera Mujer Chica",
  "MUJER|XL": "Playera Mujer XL",
};

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("Organización:", org.name, `(${org.id})`);

  const actor = await prisma.user.findFirst({ where: { organizationId: org.id } }) ?? await prisma.user.findFirst();
  if (!actor) throw new Error("No hay usuarios para atribuir los movimientos.");

  // Asegura un producto por nombre; lo crea (con costo) si no existe. Devuelve id.
  const ensureProduct = async (name: string, cost: number): Promise<string> => {
    const found = await prisma.product.findFirst({ where: { name, organizationId: org.id }, select: { id: true } });
    if (found) return found.id;
    console.log(`   + crea producto "${name}" ($${cost})`);
    if (!APPLY) return `(nuevo:${name})`;
    const p = await prisma.product.create({ data: { name, cost, unit: "pza", organizationId: org.id } });
    return p.id;
  };

  // Suma cantidad a un producto en un almacén.
  const addStock = async (productId: string, warehouseId: string, qty: number) => {
    if (!APPLY || productId.startsWith("(nuevo:")) return;
    await prisma.inventoryItem.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { quantity: { increment: qty } },
      create: { productId, warehouseId, quantity: qty },
    });
    await prisma.stockMovement.create({
      data: { type: "ENTRY", productId, toWarehouseId: warehouseId, quantity: qty, reason: MARKER, createdById: actor.id },
    });
  };

  // Piezas genéricas (una sola por tipo)
  const mochilaId = await ensureProduct("Mochila", COST.mochila);
  const gorraId = await ensureProduct("Gorra", COST.gorra);
  const lanyardId = await ensureProduct("Lanyard", COST.lanyard);

  const kits = await prisma.product.findMany({
    where: { organizationId: org.id, name: { contains: "kit para representantes", mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  console.log(`\nKits a desglosar: ${kits.length}`);

  let done = 0, skipped = 0, empty = 0;
  for (const kit of kits) {
    const m = kit.name.match(/(hombre|mujer)\s*\|\s*(xl|g|m|s)\s*$/i);
    if (!m) { console.log(`   ⚠️  No pude leer la talla de "${kit.name}" — se omite`); continue; }
    const key = `${m[1].toUpperCase()}|${m[2].toUpperCase()}`;
    const playeraName = PLAYERA_NAME[key];
    if (!playeraName) { console.log(`   ⚠️  Sin mapeo de playera para ${key} — se omite`); continue; }

    const items = await prisma.inventoryItem.findMany({
      where: { productId: kit.id, quantity: { gt: 0 } },
      include: { warehouse: { select: { name: true } } },
    });
    if (items.length === 0) { empty++; continue; }

    for (const it of items) {
      const already = await prisma.stockMovement.findFirst({
        where: { productId: kit.id, fromWarehouseId: it.warehouseId, reason: MARKER },
      });
      if (already) { skipped++; console.log(`   = ${kit.name.slice(0, 48)} @ ${it.warehouse.name}: ya desglosado, se omite`); continue; }

      const Q = it.quantity;
      console.log(`   → ${kit.name.slice(0, 48)} @ ${it.warehouse.name}: ${Q} kit -> ${Q} mochila, ${Q} gorra, ${2 * Q} lanyard, ${Q} "${playeraName}"`);
      done++;
      if (!APPLY) continue;

      const playeraId = await ensureProduct(playeraName, COST.playera);
      // Alta de piezas
      await addStock(mochilaId, it.warehouseId, Q);
      await addStock(gorraId, it.warehouseId, Q);
      await addStock(lanyardId, it.warehouseId, 2 * Q);
      await addStock(playeraId, it.warehouseId, Q);
      // Baja del kit (queda en 0) + movimiento de salida como MARCA de idempotencia
      await prisma.inventoryItem.update({ where: { id: it.id }, data: { quantity: 0 } });
      await prisma.stockMovement.create({
        data: {
          type: "EXIT",
          productId: kit.id,
          fromWarehouseId: it.warehouseId,
          quantity: Q,
          reason: MARKER,
          notes: `1 mochila + 1 gorra + 2 lanyard + 1 ${playeraName} por kit`,
          createdById: actor.id,
        },
      });
    }
  }

  console.log(`\nResumen: ${done} kits desglosados${APPLY ? "" : " (pendientes)"} | ${skipped} ya estaban | ${empty} en cero (sin stock)`);
  console.log(APPLY ? "✅ Desglose completado." : "🔍 Dry-run terminado. Nada se escribió.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
