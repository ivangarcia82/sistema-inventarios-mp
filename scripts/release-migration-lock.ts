// scripts/release-migration-lock.ts
// Libera el advisory lock de migración de Prisma que quedó colgado (error P1002:
// "Timed out trying to acquire a postgres advisory lock"). Termina SOLO las
// conexiones IDLE que están sosteniendo un advisory lock (no toca migraciones
// activas). Después de correr esto, vuelve a desplegar en Vercel.
//
// Uso (una vez):
//   npx tsx scripts/release-migration-lock.ts
import { readFileSync } from "node:fs";
import { Pool } from "pg";

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
    const holders = await c.query(`
      select a.pid, a.state, a.query, a.state_change
      from pg_locks l
      join pg_stat_activity a on a.pid = l.pid
      where l.locktype = 'advisory'
        and a.pid <> pg_backend_pid()
    `);
    if (holders.rows.length === 0) {
      console.log("✅ No hay advisory locks colgados. Ya puedes redesplegar en Vercel.");
      return;
    }
    console.log(`Conexiones con advisory lock: ${holders.rows.length}`);
    for (const r of holders.rows) {
      console.log(`  pid ${r.pid} | state=${r.state} | ${String(r.query).slice(0, 60)}`);
    }
    // Solo terminar las que NO están activas (colgadas/idle).
    let killed = 0;
    for (const r of holders.rows) {
      if (r.state !== "active") {
        const res = await c.query("select pg_terminate_backend($1) as ok", [r.pid]);
        if (res.rows[0]?.ok) killed++;
        console.log(`  ↳ terminada pid ${r.pid}`);
      } else {
        console.log(`  ↳ pid ${r.pid} está ACTIVE (migración en curso), no se toca`);
      }
    }
    console.log(`\n✅ ${killed} conexión(es) liberada(s). Ahora vuelve a desplegar en Vercel (Redeploy) para aplicar la migración.`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1); });
