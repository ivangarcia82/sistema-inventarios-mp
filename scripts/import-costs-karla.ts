// scripts/import-costs-karla.ts
// Carga el COSTO por producto (Product.cost) para la org Mercado Pago, a partir del
// Excel de costos de la clienta (que trae costos por COMPONENTE).
//
// Reglas acordadas (2026-07):
//   - Kit Para Representantes ...  -> $724   (mochila 335 + gorra 69.5 + playera 249.5 + 2×lanyard 35)
//   - Playera Dry-fit Representante Mercado Pago | (todas las tallas) -> $249.50
//   - Rompevientos Representantes Mercado Pago | (L, S, XL)           -> $416
//   - Pack De 4 Cordones Representante  -> $140   (4 × lanyard 35)
//   - Pack De Manuales Cliente Representantes        -> sin costo (pendiente)
//   - Kit Señalización Profesional Para Tienda Autorizada Amarillo    -> sin costo (pendiente)
//
// Fija el costo de forma ABSOLUTA -> idempotente.
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/import-costs-karla.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/import-costs-karla.ts --apply    # escribe
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const ORG_SLUG = process.env.MP_ORG_SLUG ?? "mercado-pago";

// Costos por componente (del Excel), por si se quiere auditar el cálculo del kit.
const C = { mochila: 335, gorra: 69.5, playera: 249.5, lanyard: 35, rompevientos: 416 };
const KIT_COST = C.mochila + C.gorra + C.playera + 2 * C.lanyard; // 724

// Reglas: primera que haga match (por subcadena, case-insensitive) gana.
// cost = null  => se marca explícitamente SIN costo (pendiente).
const RULES: { match: string; cost: number | null; label: string }[] = [
  { match: "kit señaliz",              cost: null,             label: "Kit Señalización (pendiente)" },
  { match: "pack de manuales",         cost: null,             label: "Pack De Manuales (pendiente)" },
  { match: "kit para representantes",  cost: KIT_COST,         label: `Kit Representantes = $${KIT_COST}` },
  // playera (suelta "Dry-fit" o de kit "Playera Hombre Grande", etc.)
  { match: "playera",                  cost: C.playera,        label: `Playera = $${C.playera}` },
  { match: "rompevientos",             cost: C.rompevientos,   label: `Rompevientos = $${C.rompevientos}` },
  { match: "pack de 4 cordones",       cost: 4 * C.lanyard,    label: `Pack 4 Cordones = $${4 * C.lanyard}` },
  // piezas sueltas de kit desglosado
  { match: "mochila",                  cost: C.mochila,        label: `Mochila = $${C.mochila}` },
  { match: "gorra",                    cost: C.gorra,          label: `Gorra = $${C.gorra}` },
  { match: "lanyard",                  cost: C.lanyard,        label: `Lanyard = $${C.lanyard}` },
];

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}".`);
  console.log("Organización:", org.name, `(${org.id})\n`);

  const products = await prisma.product.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let set = 0, pending = 0, noRule = 0;
  for (const p of products) {
    const n = p.name.toLowerCase();
    const rule = RULES.find((r) => n.includes(r.match));
    if (!rule) { noRule++; console.log(`   ✗ SIN REGLA: ${p.name}`); continue; }
    if (rule.cost == null) {
      pending++;
      console.log(`   ○ ${p.name.slice(0, 48)} -> pendiente (${rule.label})`);
      if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { cost: null } });
      continue;
    }
    set++;
    console.log(`   → ${p.name.slice(0, 48)} -> $${rule.cost}  [${rule.label}]`);
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { cost: rule.cost } });
  }

  console.log(`\nResumen: ${set} con costo | ${pending} pendientes (sin costo) | ${noRule} sin regla`);
  if (noRule > 0) console.log("⚠️  Hay productos sin regla de costo — revisa la lista de arriba.");
  console.log(APPLY ? "\n✅ Costos aplicados." : "\n🔍 Dry-run terminado. Nada se escribió.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
