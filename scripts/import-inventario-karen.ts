// scripts/import-inventario-karen.ts
// Carga el inventario de Karen Esquer (archivo "ultimoinventario.xlsx") y lo deja
// AISLADO del inventario de Karla, dentro de la misma organización Mercado Pago.
//
// Qué hace:
//   1. Usuario Karen Esquer (USER_MP, org Mercado Pago).
//   2. Almacén "Almacén Karen Esquer" en esa misma org.
//   3. Asigna Karen -> su almacén, y Karla -> "Almacén Mercado Pago",
//      para que ninguna vea el inventario de la otra (User.warehouseId).
//   4. Crea los 19 materiales como productos (sku = clave PV del Excel).
//   5. Inventario = columna DISPONIBLE, sin movimientos de auditoría
//      (decisión acordada: "Solo DISPONIBLE").
//
// Idempotente: se puede correr varias veces. Los productos se buscan por nombre
// dentro de la org y el inventario se fija de forma ABSOLUTA.
//
// Uso:
//   DATABASE_URL="<url>" npx tsx scripts/import-inventario-karen.ts            # dry-run
//   DATABASE_URL="<url>" npx tsx scripts/import-inventario-karen.ts --apply    # escribe
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

// Almacén al que queda restringida Karla (el que ya tiene su inventario).
const KARLA_EMAIL = "karla@mercadopago.com";
const KARLA_WAREHOUSE = "Almacén Mercado Pago";

interface Item {
  pv: string;
  nombre: string;
  nombreOriginal: string;
  recibido: number;
  salidas: number;
  disponible: number;
}
interface Data {
  origen: string;
  organizationSlug: string;
  warehouse: string;
  user: { name: string; email: string; password: string; role: string };
  items: Item[];
}

const data: Data = JSON.parse(
  readFileSync(join(__dirname, "inventario-karen.data.json"), "utf-8")
);

const url = process.env.DATABASE_URL ?? "";
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  console.log(APPLY ? "✍️  APLICANDO (escribe en la base)\n" : "🔍 DRY-RUN (no escribe). Usa --apply para escribir.\n");
  console.log("Origen:", data.origen, "\n");

  const org = await prisma.organization.findUnique({ where: { slug: data.organizationSlug } });
  if (!org) throw new Error(`No existe la organización slug="${data.organizationSlug}".`);
  console.log("Organización:", org.name, `(${org.id})`);

  // ---- 1) Almacén de Karen ----
  let warehouse = await prisma.warehouse.findFirst({
    where: { name: data.warehouse, organizationId: org.id },
  });
  console.log(`\nAlmacén "${data.warehouse}": ${warehouse ? "ya existe" : "se CREARÁ"}`);
  if (APPLY && !warehouse) {
    warehouse = await prisma.warehouse.create({
      data: { name: data.warehouse, organizationId: org.id },
    });
    console.log("  ✅ almacén creado");
  }

  // ---- 2) Usuario Karen ----
  const existingUser = await prisma.user.findUnique({ where: { email: data.user.email } });
  console.log(
    `Usuario ${data.user.email}: ${existingUser ? "ya existe (se conserva la contraseña)" : "se CREARÁ"} -> ${data.user.name} / ${data.user.role}`
  );
  let karen = existingUser;
  if (APPLY && !karen) {
    karen = await prisma.user.create({
      data: {
        email: data.user.email,
        password: await bcrypt.hash(data.user.password, 10),
        name: data.user.name,
        role: data.user.role,
        organizationId: org.id,
        warehouseId: warehouse!.id,
      },
    });
    console.log(`  ✅ usuario creado (contraseña: ${data.user.password})`);
  }

  // ---- 3) Asignaciones de almacén (aislamiento) ----
  if (APPLY && karen && warehouse && karen.warehouseId !== warehouse.id) {
    await prisma.user.update({ where: { id: karen.id }, data: { warehouseId: warehouse.id } });
    console.log(`  ✅ Karen restringida a "${data.warehouse}"`);
  }

  const karla = await prisma.user.findUnique({ where: { email: KARLA_EMAIL } });
  const karlaWh = await prisma.warehouse.findFirst({
    where: { name: KARLA_WAREHOUSE, organizationId: org.id },
  });
  if (!karla) {
    console.log(`\n⚠️  No se encontró ${KARLA_EMAIL}; no se restringe a nadie más.`);
  } else if (!karlaWh) {
    console.log(`\n⚠️  No existe el almacén "${KARLA_WAREHOUSE}"; Karla queda sin restringir.`);
  } else if (karla.warehouseId === karlaWh.id) {
    console.log(`\nKarla ya está restringida a "${KARLA_WAREHOUSE}".`);
  } else {
    console.log(`\nKarla se restringirá a "${KARLA_WAREHOUSE}" (hoy ve toda la organización).`);
    if (APPLY) {
      await prisma.user.update({ where: { id: karla.id }, data: { warehouseId: karlaWh.id } });
      console.log("  ✅ Karla restringida");
    }
  }

  // ---- 4) Productos + 5) inventario ----
  console.log(`\n=== ${data.items.length} materiales ===`);
  let creados = 0;
  let existentes = 0;
  let totalDisponible = 0;

  for (const item of data.items) {
    let product = await prisma.product.findFirst({
      where: { name: item.nombre, organizationId: org.id },
    });
    const esNuevo = !product;
    if (esNuevo) creados++;
    else existentes++;

    if (APPLY && !product) {
      product = await prisma.product.create({
        data: {
          name: item.nombre,
          sku: item.pv,
          unit: "pza",
          description: `Recibido ${item.recibido} · Salidas ${item.salidas} (${data.origen})`,
          organizationId: org.id,
        },
      });
    }

    if (APPLY && product && warehouse) {
      await prisma.inventoryItem.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
        update: { quantity: item.disponible },
        create: { productId: product.id, warehouseId: warehouse.id, quantity: item.disponible },
      });
    }

    totalDisponible += item.disponible;
    console.log(
      `  ${esNuevo ? "+" : "·"} ${item.nombre.padEnd(52)} ${String(item.disponible).padStart(6)} pza  [${item.pv}]`
    );
  }

  console.log(`\nProductos nuevos: ${creados} | ya existentes: ${existentes}`);
  console.log(`Total en "${data.warehouse}": ${totalDisponible.toLocaleString("es-MX")} piezas`);
  console.log(APPLY ? "\n✅ Carga completada." : "\n🔍 Dry-run terminado. Nada se escribió.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
