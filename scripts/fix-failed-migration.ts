// scripts/fix-failed-migration.ts
// Desbloquea las migraciones en producción (error P3009): marca como "rolled-back"
// la migración fallida `20260706000000_add_product_cost_and_pieces`, que quedó de un
// deploy preview anterior y NO aplicó ningún cambio (applied_steps_count = 0; la
// columna `cost` la aplicó correctamente `20260706000000_add_product_cost`).
//
// Equivale a `prisma migrate resolve --rolled-back <migración>`, pero por pg directo
// porque el engine de migración de Prisma hace timeout contra Neon desde local.
//
// Uso (una vez):
//   npx tsx scripts/fix-failed-migration.ts
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const FAILED = "20260706000000_add_product_cost_and_pieces";

function prodUrl(): string {
  const txt = [".env", ".env.local", ".env.vercel"]
    .map((f) => { try { return readFileSync(f, "utf-8"); } catch { return ""; } })
    .join("\n");
  const m =
    txt.match(/^DATABASE_URL_UNPOOLED="?([^"\n]+)"?/m) ||
    txt.match(/^DATABASE_POSTGRES_URL_NON_POOLING="?([^"\n]+)"?/m);
  if (!m) throw new Error("No encontré la URL unpooled de producción en .env.vercel");
  return m[1];
}

async function main() {
  const pool = new Pool({ connectionString: prodUrl(), ssl: { rejectUnauthorized: false } });
  const c = await pool.connect();
  try {
    const before = await c.query(
      'select migration_name, finished_at, rolled_back_at, applied_steps_count from "_prisma_migrations" where migration_name = $1',
      [FAILED]
    );
    if (before.rows.length === 0) {
      console.log(`Nada que hacer: la migración "${FAILED}" ya no está registrada.`);
      return;
    }
    const row = before.rows[0];
    if (row.finished_at) {
      console.log(`⚠️  "${FAILED}" figura como APLICADA (finished_at). No la toco. Revisa manualmente.`);
      return;
    }
    if (row.applied_steps_count !== 0) {
      console.log(`⚠️  "${FAILED}" tiene applied_steps_count=${row.applied_steps_count} (aplicó algo). No la toco. Revisa manualmente.`);
      return;
    }
    // Aplicó 0 pasos → marcarla como rolled-back para desbloquear (P3009).
    const res = await c.query(
      'update "_prisma_migrations" set rolled_back_at = now() where migration_name = $1 and finished_at is null and applied_steps_count = 0',
      [FAILED]
    );
    console.log(`✅ Migración "${FAILED}" marcada como rolled-back (${res.rowCount} fila). Migraciones desbloqueadas.`);
    console.log("Siguiente: vuelve a desplegar en Vercel (o hago un commit vacío) para aplicar 20260707000000_add_colectaitem_kit.");
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1); });
