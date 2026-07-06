// scripts/import-costs-karla.ts
// Carga el COSTO por producto (Product.cost) para la org Mercado Pago.
// Lee scripts/costs-karla.data.json (que se genera del Excel de costos de la clienta):
//   [ { "sku": "1478754818", "name": "Kit Para Representantes...", "cost": 82.50 }, ... ]
// - "cost": null  -> producto sin costo (los 2 que la clienta sigue validando).
// - Match: primero por SKU (exacto), si no por nombre (exacto), si no por nombre (contiene).
//
// Fija el costo de forma ABSOLUTA -> idempotente (re-correr da el mismo resultado).
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/import-costs-karla.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/import-costs-karla.ts --apply    # escribe
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";

type CostRow = { sku?: string | null; name?: string | null; cost: number | null };

const dataPath = join(__dirname, "costs-karla.data.json");
let data: CostRow[];
try {
  data = JSON.parse(readFileSync(dataPath, "utf-8"));
} catch {
  console.error(`❌ Falta ${dataPath}. Genera ese JSON a partir del Excel de costos antes de correr este script.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("Organización:", org.name, `(${org.id})\n`);

  const products = await prisma.product.findMany({ where: { organizationId: org.id } });
  const bySku = new Map<string, typeof products>();
  const byName = new Map<string, typeof products>();
  for (const p of products) {
    if (p.sku) { const k = p.sku.trim(); (bySku.get(k) ?? bySku.set(k, []).get(k)!).push(p); }
    const nk = norm(p.name); (byName.get(nk) ?? byName.set(nk, []).get(nk)!).push(p);
  }

  const matchedIds = new Set<string>();
  let set = 0, nullCost = 0, notFound = 0, ambiguous = 0;

  for (const row of data) {
    let candidates: typeof products = [];
    let how = "";
    if (row.sku && bySku.has(row.sku.trim())) { candidates = bySku.get(row.sku.trim())!; how = "sku"; }
    else if (row.name && byName.has(norm(row.name))) { candidates = byName.get(norm(row.name))!; how = "nombre"; }
    else if (row.name) {
      const nk = norm(row.name);
      candidates = products.filter((p) => norm(p.name).includes(nk) || nk.includes(norm(p.name)));
      how = "nombre~";
    }

    const label = row.sku ?? row.name ?? "(sin id)";
    if (candidates.length === 0) { notFound++; console.log(`   ✗ NO ENCONTRADO: ${label}`); continue; }
    if (candidates.length > 1) { ambiguous++; console.log(`   ? AMBIGUO (${candidates.length}) por ${how}: ${label} -> ${candidates.map((c) => c.name.slice(0, 30)).join(" | ")}`); continue; }

    const p = candidates[0];
    matchedIds.add(p.id);
    if (row.cost == null) { nullCost++; console.log(`   ○ sin costo (pendiente): ${p.name.slice(0, 50)}`); if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { cost: null } }); continue; }
    console.log(`   → ${p.name.slice(0, 50)} [${how}]: costo = ${row.cost}`);
    set++;
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { cost: row.cost } });
  }

  const withoutRow = products.filter((p) => !matchedIds.has(p.id));
  console.log(`\nResumen: ${set} costos asignados | ${nullCost} marcados sin costo | ${notFound} no encontrados | ${ambiguous} ambiguos`);
  if (withoutRow.length) {
    console.log(`\n⚠️  ${withoutRow.length} productos de la org SIN fila en el Excel de costos:`);
    withoutRow.forEach((p) => console.log(`     · ${p.name}${p.sku ? ` (${p.sku})` : ""}`));
  }
  console.log(APPLY ? "\n✅ Costos aplicados." : "\n🔍 Dry-run terminado. Nada se escribió.");
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
