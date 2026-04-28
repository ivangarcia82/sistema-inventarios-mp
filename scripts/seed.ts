// scripts/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Organizaciones
  const gi = await prisma.organization.upsert({
    where: { slug: "generando-ideas" },
    update: {},
    create: { name: "Generando Ideas", slug: "generando-ideas" },
  });
  console.log("✅ Organización GI:", gi.name);

  const mp = await prisma.organization.upsert({
    where: { slug: "mercado-pago" },
    update: {},
    create: { name: "Mercado Pago", slug: "mercado-pago" },
  });
  console.log("✅ Organización Mercado Pago:", mp.name);

  // Almacenes GI
  const giAlmacen = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Almacén Central GI", organizationId: gi.id } },
    update: {},
    create: { name: "Almacén Central GI", organizationId: gi.id },
  });
  console.log("✅ Almacén GI:", giAlmacen.name);

  // Almacenes Mercado Pago
  const mpCDMX = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina CDMX", organizationId: mp.id } },
    update: {},
    create: { name: "Oficina CDMX", organizationId: mp.id },
  });
  const mpMTY = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina Monterrey", organizationId: mp.id } },
    update: {},
    create: { name: "Oficina Monterrey", organizationId: mp.id },
  });
  console.log("✅ Almacenes Mercado Pago:", mpCDMX.name, "|", mpMTY.name);

  // Usuario Admin GI
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@generandoideas.com" },
    update: {},
    create: {
      email: "admin@generandoideas.com",
      password: adminPassword,
      name: "Administrador GI",
      role: "ADMIN_GI",
      organizationId: gi.id,
    },
  });
  console.log("✅ Usuario admin:", admin.email);

  // Usuario demo Mercado Pago
  const mpPassword = await bcrypt.hash("mercadopago123", 10);
  const mpUser = await prisma.user.upsert({
    where: { email: "usuario@mercadopago.com" },
    update: {},
    create: {
      email: "usuario@mercadopago.com",
      password: mpPassword,
      name: "Usuario Mercado Pago Demo",
      role: "USER_MP",
      organizationId: mp.id,
    },
  });
  console.log("✅ Usuario Mercado Pago:", mpUser.email);

  console.log("\n📋 Credenciales:");
  console.log("   Admin GI:           admin@generandoideas.com / admin123");
  console.log("   Usuario Mercado Pago: usuario@mercadopago.com / mercadopago123");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
