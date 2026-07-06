// scripts/setup-kits-karla.ts
// "Volumen completo" de los Kit sin multiplicar el inventario:
//   - unidad = "kit"
//   - piecesPerUnit = 5  (1 mochila + 1 gorra + 1 playera + 2 lanyard)
// Así el inventario cuenta KITS y la UI muestra el volumen en piezas (kits x 5)
// como dato derivado. El costo del kit se carga aparte (import-costs-karla = $724).
//
// Aplica a "Kit Para Representantes ..."; EXCLUYE "Kit Señalización" (no es kit de ropa).
// Idempotente (fija valores absolutos).
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/setup-kits-karla.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/setup-kits-karla.ts --apply    # escribe
//
// Config opcional:
//   KIT_PIECES=5                     piezas por kit
//   KIT_EXCLUDE="Kit Señalización"   subcadenas a EXCLUIR, separadas por "|"
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";
const PIECES = Number(process.env.KIT_PIECES ?? "5");
const EXCLUDE = (process.env.KIT_EXCLUDE ?? "Kit Señalización")
  .split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");
  console.log(`Kit => unidad "kit", piecesPerUnit=${PIECES}`);
  if (EXCLUDE.length) console.log(`Excluidos: ${EXCLUDE.join(", ")}`);

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("\nOrganización:", org.name, `(${org.id})`);

  // select sin piecesPerUnit para poder correr el dry-run aunque la columna aún
  // no exista en la base (la migración se aplica al desplegar).
  const kits = (await prisma.product.findMany({
    where: { organizationId: org.id, name: { contains: "kit", mode: "insensitive" } },
    select: { id: true, name: true, unit: true },
    orderBy: { name: "asc" },
  })).filter((p) => !EXCLUDE.some((ex) => p.name.toLowerCase().includes(ex)));

  console.log(`\nProductos Kit a configurar: ${kits.length}`);
  for (const p of kits) {
    console.log(`   → ${p.name.slice(0, 55)}  (unit ${p.unit}→kit, piecesPerUnit=${PIECES})`);
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { unit: "kit", piecesPerUnit: PIECES } });
    }
  }

  console.log(`\nResumen: ${kits.length} kits ${APPLY ? "configurados (unidad kit, " + PIECES + " pzas c/u)" : "por configurar"}`);
  console.log(APPLY ? "✅ Listo." : "🔍 Dry-run terminado. Nada se escribió.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
