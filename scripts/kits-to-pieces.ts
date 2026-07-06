// scripts/kits-to-pieces.ts
// "Volumen completo": los productos cuyo nombre contiene "Kit" se cuentan por sus
// piezas. Cada kit = 5 piezas (1 mochila + 1 gorra + 1 playera + 2 lanyard).
// Multiplica el INVENTARIO de cada producto Kit por 5 (deja las colectas históricas igual).
//
// Idempotente: registra un StockMovement de ajuste como MARCA. Si ya existe para
// ese producto+almacén, no vuelve a multiplicar.
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/kits-to-pieces.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/kits-to-pieces.ts --apply    # escribe
//
// Config opcional:
//   KIT_MULT=5                       multiplicador (piezas por kit)
//   KIT_EXCLUDE="Kit Señalización"   nombres (o subcadenas) a EXCLUIR, separados por "|"
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";
const MULT = Number(process.env.KIT_MULT ?? "5");
// Por defecto se excluye "Kit Señalización" (es señalización, no un kit de 5 piezas).
const EXCLUDE = (process.env.KIT_EXCLUDE ?? "Kit Señalización").split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
const MARKER = `Ajuste volumen kit (x${MULT})`;
const CONTENTS = "1 mochila + 1 gorra + 1 playera + 2 lanyard";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");
  console.log(`Multiplicador: x${MULT}  (${CONTENTS})`);
  if (EXCLUDE.length) console.log(`Excluidos: ${EXCLUDE.join(", ")}`);

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("\nOrganización:", org.name, `(${org.id})`);

  const actor = await prisma.user.findFirst({ where: { organizationId: org.id } }) ?? await prisma.user.findFirst();
  if (!actor) throw new Error("No hay usuarios para atribuir el movimiento de ajuste.");

  // Productos Kit (por nombre), respetando exclusiones.
  // select explícito para no depender de columnas nuevas (p. ej. cost) que quizá
  // aún no existan en la base si la migración no se ha desplegado.
  const kitProducts = (await prisma.product.findMany({
    where: { organizationId: org.id, name: { contains: "kit", mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })).filter((p) => !EXCLUDE.some((ex) => p.name.toLowerCase().includes(ex)));

  console.log(`\nProductos Kit detectados: ${kitProducts.length}`);
  kitProducts.forEach((p) => console.log(`   · ${p.name}`));
  if (kitProducts.length === 0) { await done(); return; }

  let applied = 0, skipped = 0, zero = 0;
  console.log("\n=== Inventario a ajustar ===");
  for (const p of kitProducts) {
    const items = await prisma.inventoryItem.findMany({
      where: { productId: p.id },
      include: { warehouse: { select: { name: true } } },
    });
    for (const it of items) {
      if (it.quantity === 0) { zero++; continue; }
      const already = await prisma.stockMovement.findFirst({
        where: { productId: p.id, toWarehouseId: it.warehouseId, reason: MARKER },
      });
      if (already) {
        skipped++;
        console.log(`   = ${p.name.slice(0, 45)} @ ${it.warehouse.name}: ya ajustado (${it.quantity}), se omite`);
        continue;
      }
      const newQty = it.quantity * MULT;
      const delta = newQty - it.quantity;
      console.log(`   → ${p.name.slice(0, 45)} @ ${it.warehouse.name}: ${it.quantity} → ${newQty} (+${delta})`);
      applied++;
      if (!APPLY) continue;
      await prisma.$transaction([
        prisma.inventoryItem.update({ where: { id: it.id }, data: { quantity: newQty } }),
        prisma.stockMovement.create({
          data: {
            type: "ENTRY",
            productId: p.id,
            toWarehouseId: it.warehouseId,
            quantity: delta,
            reason: MARKER,
            notes: `Volumen completo de kit: ${CONTENTS} (x${MULT})`,
            createdById: actor.id,
          },
        }),
      ]);
    }
  }

  console.log(`\nResumen: ${applied} ajustados${APPLY ? "" : " (pendientes)"} | ${skipped} ya estaban | ${zero} en cero (omitidos)`);
  console.log(APPLY ? "✅ Ajuste completado." : "🔍 Dry-run terminado. Nada se escribió.");
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
