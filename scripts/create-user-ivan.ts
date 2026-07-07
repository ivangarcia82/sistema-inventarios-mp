// scripts/create-user-ivan.ts
// Crea el usuario ADMIN_GI de Ivan (puede registrar movimientos).
//
// Idempotente: si el correo ya existe, NO lo modifica (conserva su contraseña).
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/create-user-ivan.ts            # dry-run (no escribe)
//   DATABASE_URL="<url>" npx tsx scripts/create-user-ivan.ts --apply    # escribe
//
// Config opcional por env:
//   IVAN_EMAIL     (default ivanalex.gp35@gmail.com)
//   IVAN_NAME      (default "Iván García")
//   IVAN_PASSWORD  (default: se genera una aleatoria y se imprime)
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const EMAIL = process.env.IVAN_EMAIL ?? "ivanalex.gp35@gmail.com";
const NAME = process.env.IVAN_NAME ?? "Iván García";
// Contraseña legible y fuerte si no se especifica una.
const PASSWORD = process.env.IVAN_PASSWORD ?? `GI-${randomBytes(4).toString("hex")}-${randomBytes(2).toString("hex")}`;
const ORG_SLUG = process.env.GI_ORG_SLUG ?? "generando-ideas";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`No existe la organización slug="${ORG_SLUG}". Corre el seed primero.`);
  console.log("Organización:", org.name, `(${org.id})`);

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`\nUsuario ${EMAIL}: YA EXISTE (se conserva).`);
    console.log(`  nombre: ${existing.name} | rol: ${existing.role}`);
    if (existing.role !== "ADMIN_GI") {
      console.log(`  ⚠️  Su rol NO es ADMIN_GI. ${APPLY ? "Se actualizará a ADMIN_GI." : "Con --apply se actualizará a ADMIN_GI."}`);
      if (APPLY) {
        await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN_GI", organizationId: org.id } });
        console.log("  ✅ rol actualizado a ADMIN_GI");
      }
    }
    await done();
    return;
  }

  console.log(`\nUsuario ${EMAIL}: se CREARÁ -> ${NAME} / ADMIN_GI / org ${org.name}`);
  if (!APPLY) {
    console.log("  (dry-run: no se crea)");
    await done();
    return;
  }

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const u = await prisma.user.create({
    data: { email: EMAIL, password: hashed, name: NAME, role: "ADMIN_GI", organizationId: org.id },
  });
  console.log("  ✅ usuario creado:", u.email);
  console.log("\n==================== CREDENCIALES ====================");
  console.log(`  Correo:      ${EMAIL}`);
  console.log(`  Contraseña:  ${PASSWORD}`);
  console.log("  (Guárdala. No hay pantalla de cambio de contraseña aún.)");
  console.log("=====================================================");

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
