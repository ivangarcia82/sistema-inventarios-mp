# Módulo de Colectas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un módulo de "Colectas" (recolecciones MP/ML) con identificadores, ciclo de vida con cronómetro de 48h, avisos in-system a la clienta y descuento de inventario al recolectar; más el renombrado Devoluciones→Retiros.

**Architecture:** Entidad `Colecta` con líneas (`ColectaItem`) y avisos (`ColectaAviso`) en Prisma/Postgres. La lógica pura de negocio (transiciones de estado, cálculo de 48h, texto de avisos, cronómetro) vive en `src/lib/colectas-logic.ts` y se prueba con vitest. Server actions en `src/app/actions/colectas.ts` componen esa lógica con Prisma y reutilizan el patrón de descuento de inventario del POS. Pantallas Next.js (App Router) bajo `src/app/(app)/colectas/`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma 6 + Postgres, next-auth 5 (beta), Tailwind v4, lucide-react, date-fns, vitest (nuevo, solo para lógica pura).

## Global Constraints

- Roles: `ADMIN_GI` (ve todas las organizaciones) y `USER_MP` (solo su organización). Toda action valida sesión con `auth()` y pertenencia a organización, igual que las actions existentes.
- Las actions devuelven el patrón discriminado existente: `{ success: true, data }` | `{ success: false, error }` (usar `as const`).
- Campos `Decimal` de Prisma (ej. `Product.price`) se serializan a `Number` antes de cruzar a componentes cliente (patrón en `src/app/actions/inventory.ts`).
- El valor interno del tipo de movimiento `RETURN` NO cambia; solo cambia la palabra visible "Devolución/Devoluciones" → "Retiro/Retiros".
- Estados de Colecta (string): `"CREADA" | "EN_PREPARACION" | "LISTA" | "RECOLECTADA" | "CANCELADA"`.
- Método de entrega (string): `"RECOLECCION" | "ENVIO"`, default `"RECOLECCION"`.
- Ventana de preparación: **48 horas** exactas desde `tallerArrivedAt`.
- Tipos de aviso: `"LLEGO_TALLER" | "LISTA"`.
- Documentos de Karla (punto 6) están FUERA DE ALCANCE en este plan.
- Idioma de toda la UI: español.

**Prerrequisito:** `DATABASE_URL` apunta a un Postgres accesible; `npx prisma migrate dev` puede aplicar migraciones.

---

### Task 1: Renombrado "Devoluciones" → "Retiros"

Cambia solo etiquetas visibles. El valor `RETURN` interno se conserva.

**Files:**
- Modify: `src/components/pos/movement-form.tsx`
- Modify: `src/app/(app)/movements/page.tsx`
- Modify: `src/app/(app)/movements/new/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/lib/generate-remision.ts`

- [ ] **Step 1: `movement-form.tsx` — etiqueta del tipo RETURN**

En `src/components/pos/movement-form.tsx`, dentro de `typeConfig`, cambia la línea de `RETURN`:

```ts
  RETURN:   { label: "Retiro",         needsFrom: false, needsTo: true,  activeCls: "bg-amber-500 text-white border-amber-500" },
```

- [ ] **Step 2: `movements/page.tsx` — typeConfig y filtros**

En `src/app/(app)/movements/page.tsx`, cambia la línea `RETURN` de `typeConfig`:

```ts
  RETURN:   { label: "Retiro",        icon: RotateCcw,      badge: "bg-amber-100 text-amber-700" },
```

Y en `TYPE_FILTERS`, la entrada de `RETURN`:

```ts
  { value: "RETURN",   label: "Retiros" },
```

- [ ] **Step 3: `movements/new/page.tsx` — descripción**

En `src/app/(app)/movements/new/page.tsx`, cambia el `<p>`:

```tsx
      <p className="text-sm text-slate-500 mb-6">Registra entradas, salidas, transferencias o retiros.</p>
```

- [ ] **Step 4: `dashboard/page.tsx` — config y chart**

En `src/app/(app)/dashboard/page.tsx`, cambia la línea `RETURN` de `movementTypeConfig`:

```ts
  RETURN:   { label: "Retiro",        color: "bg-amber-100 text-amber-700" },
```

Y en el `chartData`, el mapa de nombres:

```ts
    name: { ENTRY: "Entradas", EXIT: "Salidas", TRANSFER: "Transfer.", RETURN: "Retiros" }[type] ?? type,
```

- [ ] **Step 5: `generate-remision.ts` — etiqueta PDF**

En `src/lib/generate-remision.ts`, cambia en `TYPE_LABELS`:

```ts
  RETURN:   "Retiro",
```

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificar que no quedan etiquetas viejas**

Run: `grep -rni "devoluci" src --include="*.tsx" --include="*.ts"`
Expected: sin resultados (exit code 1).

- [ ] **Step 8: Commit**

```bash
git add src/components/pos/movement-form.tsx "src/app/(app)/movements/page.tsx" "src/app/(app)/movements/new/page.tsx" "src/app/(app)/dashboard/page.tsx" src/lib/generate-remision.ts
git commit -m "refactor: renombrar Devoluciones a Retiros en la UI"
```

---

### Task 2: Migración del precio de producto (valor monetario)

El campo `Product.price` ya está en el schema (sin migrar). Esta task lo migra para que el "Valor inventario" funcione contra la base de datos.

**Files:**
- Migrate: `prisma/schema.prisma` (ya contiene `price Decimal? @db.Decimal(10, 2)`; sin cambios de archivo)
- Create: `prisma/migrations/<timestamp>_add_product_price/migration.sql` (lo genera Prisma)

- [ ] **Step 1: Confirmar el diff pendiente**

Run: `git diff prisma/schema.prisma`
Expected: muestra únicamente la adición de `price Decimal? @db.Decimal(10, 2)` en `Product`.

- [ ] **Step 2: Crear y aplicar la migración**

Run: `npx prisma migrate dev --name add_product_price`
Expected: crea la carpeta de migración, aplica la columna `price` y regenera el cliente. Termina con "Your database is now in sync with your schema."

- [ ] **Step 3: Verificar typecheck/build de prisma**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: migrar columna price de Product (valor monetario)"
```

---

### Task 3: Lógica pura de Colectas + pruebas (vitest)

Toda la lógica de negocio sin dependencias (transiciones, 48h, cronómetro, texto de avisos, etiquetas) en un módulo puro, probada con vitest.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)
- Create: `src/lib/colectas-logic.ts`
- Test: `src/lib/colectas-logic.test.ts`

**Interfaces (produce — lo consumen Tasks 5, 6, 7, 9):**
- `COLECTA_STATUS`, `ColectaStatus`, `METODO_ENTREGA`, `AVISO_TIPO`
- `PREP_WINDOW_HOURS = 48`
- `STATUS_LABELS: Record<ColectaStatus, string>`, `STATUS_BADGE: Record<ColectaStatus, string>`
- `METODO_LABELS: Record<string, string>`
- `nextFolio(count: number): string`
- `computeDeadline(arrivedAt: Date): Date`
- `validateTransition(current: string, action: ColectaAction): { ok: true; next: ColectaStatus } | { ok: false; error: string }`
- `getCountdownState(deadlineISO: string, nowMs: number): { msRemaining: number; expired: boolean; level: "green" | "amber" | "red"; label: string }`
- `buildAvisoMessage(tipo: AvisoTipo, ctx: { clienteNombre?: string | null; numeroColecta?: string | null; folio: string }): string`
- `type ColectaAction = "LLEGO_TALLER" | "MARCAR_LISTA" | "MARCAR_RECOLECTADA" | "CANCELAR"`
- `type AvisoTipo = "LLEGO_TALLER" | "LISTA"`

- [ ] **Step 1: Instalar vitest**

Run: `npm install -D vitest`
Expected: agrega `vitest` a devDependencies.

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Agregar scripts en `package.json`**

En `"scripts"`, agrega:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Escribir las pruebas (fallan primero)**

Crea `src/lib/colectas-logic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PREP_WINDOW_HOURS,
  nextFolio,
  computeDeadline,
  validateTransition,
  getCountdownState,
  buildAvisoMessage,
  STATUS_LABELS,
  METODO_LABELS,
} from "./colectas-logic";

describe("nextFolio", () => {
  it("formatea consecutivo a 4 dígitos con prefijo COL-", () => {
    expect(nextFolio(0)).toBe("COL-0001");
    expect(nextFolio(41)).toBe("COL-0042");
    expect(nextFolio(9999)).toBe("COL-10000");
  });
});

describe("computeDeadline", () => {
  it("suma 48 horas exactas", () => {
    const arrived = new Date("2026-06-23T10:00:00.000Z");
    expect(computeDeadline(arrived).toISOString()).toBe("2026-06-25T10:00:00.000Z");
  });
  it("PREP_WINDOW_HOURS es 48", () => {
    expect(PREP_WINDOW_HOURS).toBe(48);
  });
});

describe("validateTransition", () => {
  it("CREADA + LLEGO_TALLER -> EN_PREPARACION", () => {
    expect(validateTransition("CREADA", "LLEGO_TALLER")).toEqual({ ok: true, next: "EN_PREPARACION" });
  });
  it("EN_PREPARACION + MARCAR_LISTA -> LISTA", () => {
    expect(validateTransition("EN_PREPARACION", "MARCAR_LISTA")).toEqual({ ok: true, next: "LISTA" });
  });
  it("LISTA + MARCAR_RECOLECTADA -> RECOLECTADA", () => {
    expect(validateTransition("LISTA", "MARCAR_RECOLECTADA")).toEqual({ ok: true, next: "RECOLECTADA" });
  });
  it("permite CANCELAR desde estados no terminales", () => {
    expect(validateTransition("CREADA", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
    expect(validateTransition("EN_PREPARACION", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
    expect(validateTransition("LISTA", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
  });
  it("rechaza transición inválida", () => {
    const r = validateTransition("CREADA", "MARCAR_RECOLECTADA");
    expect(r.ok).toBe(false);
  });
  it("rechaza cancelar una colecta ya recolectada", () => {
    expect(validateTransition("RECOLECTADA", "CANCELAR").ok).toBe(false);
  });
});

describe("getCountdownState", () => {
  const deadline = "2026-06-25T10:00:00.000Z";
  it("verde cuando faltan más de 24h", () => {
    const now = new Date("2026-06-23T10:00:00.000Z").getTime();
    const s = getCountdownState(deadline, now);
    expect(s.expired).toBe(false);
    expect(s.level).toBe("green");
  });
  it("ámbar cuando faltan 24h o menos", () => {
    const now = new Date("2026-06-24T12:00:00.000Z").getTime();
    expect(getCountdownState(deadline, now).level).toBe("amber");
  });
  it("rojo y expired cuando ya pasó", () => {
    const now = new Date("2026-06-26T10:00:00.000Z").getTime();
    const s = getCountdownState(deadline, now);
    expect(s.expired).toBe(true);
    expect(s.level).toBe("red");
  });
});

describe("buildAvisoMessage", () => {
  it("LLEGO_TALLER usa numeroColecta y nombre del cliente", () => {
    const msg = buildAvisoMessage("LLEGO_TALLER", { clienteNombre: "Karla", numeroColecta: "ML-44920", folio: "COL-0001" });
    expect(msg).toContain("Karla");
    expect(msg).toContain("ML-44920");
    expect(msg).toContain("llegó de taller");
  });
  it("LISTA cae al folio cuando no hay numeroColecta", () => {
    const msg = buildAvisoMessage("LISTA", { clienteNombre: null, numeroColecta: null, folio: "COL-0007" });
    expect(msg).toContain("COL-0007");
    expect(msg).toContain("listo");
    expect(msg).not.toContain("undefined");
  });
});

describe("etiquetas", () => {
  it("STATUS_LABELS y METODO_LABELS están completas", () => {
    expect(STATUS_LABELS.EN_PREPARACION).toBe("En preparación");
    expect(METODO_LABELS.RECOLECCION).toBe("Recolección");
    expect(METODO_LABELS.ENVIO).toBe("Envío");
  });
});
```

- [ ] **Step 5: Correr pruebas para verificar que fallan**

Run: `npm test`
Expected: FAIL — el módulo `./colectas-logic` no existe aún.

- [ ] **Step 6: Implementar `src/lib/colectas-logic.ts`**

```ts
// src/lib/colectas-logic.ts
// Lógica pura de Colectas: estados, transiciones, cronómetro 48h y avisos.
// Sin dependencias de Prisma/React para poder probarse con vitest.

export const COLECTA_STATUS = {
  CREADA: "CREADA",
  EN_PREPARACION: "EN_PREPARACION",
  LISTA: "LISTA",
  RECOLECTADA: "RECOLECTADA",
  CANCELADA: "CANCELADA",
} as const;

export type ColectaStatus = keyof typeof COLECTA_STATUS;

export const METODO_ENTREGA = {
  RECOLECCION: "RECOLECCION",
  ENVIO: "ENVIO",
} as const;

export type ColectaAction = "LLEGO_TALLER" | "MARCAR_LISTA" | "MARCAR_RECOLECTADA" | "CANCELAR";
export type AvisoTipo = "LLEGO_TALLER" | "LISTA";

export const PREP_WINDOW_HOURS = 48;

export const STATUS_LABELS: Record<ColectaStatus, string> = {
  CREADA: "Creada",
  EN_PREPARACION: "En preparación",
  LISTA: "Lista",
  RECOLECTADA: "Recolectada",
  CANCELADA: "Cancelada",
};

export const STATUS_BADGE: Record<ColectaStatus, string> = {
  CREADA: "bg-slate-100 text-slate-600",
  EN_PREPARACION: "bg-primary/10 text-primary",
  LISTA: "bg-emerald-100 text-emerald-700",
  RECOLECTADA: "bg-violet-100 text-violet-700",
  CANCELADA: "bg-red-100 text-red-600",
};

export const METODO_LABELS: Record<string, string> = {
  RECOLECCION: "Recolección",
  ENVIO: "Envío",
};

export function nextFolio(count: number): string {
  return `COL-${String(count + 1).padStart(4, "0")}`;
}

export function computeDeadline(arrivedAt: Date): Date {
  return new Date(arrivedAt.getTime() + PREP_WINDOW_HOURS * 60 * 60 * 1000);
}

const TRANSITIONS: Record<ColectaAction, { from: ColectaStatus[]; next: ColectaStatus }> = {
  LLEGO_TALLER: { from: ["CREADA"], next: "EN_PREPARACION" },
  MARCAR_LISTA: { from: ["EN_PREPARACION"], next: "LISTA" },
  MARCAR_RECOLECTADA: { from: ["LISTA"], next: "RECOLECTADA" },
  CANCELAR: { from: ["CREADA", "EN_PREPARACION", "LISTA"], next: "CANCELADA" },
};

export function validateTransition(
  current: string,
  action: ColectaAction
): { ok: true; next: ColectaStatus } | { ok: false; error: string } {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, error: "Acción desconocida" };
  if (!t.from.includes(current as ColectaStatus)) {
    return { ok: false, error: `No se puede aplicar "${action}" desde el estado ${current}` };
  }
  return { ok: true, next: t.next };
}

export function getCountdownState(
  deadlineISO: string,
  nowMs: number
): { msRemaining: number; expired: boolean; level: "green" | "amber" | "red"; label: string } {
  const deadlineMs = new Date(deadlineISO).getTime();
  const msRemaining = deadlineMs - nowMs;
  const expired = msRemaining <= 0;

  const absMin = Math.floor(Math.abs(msRemaining) / 60000);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const hm = `${h}h ${m}m`;

  if (expired) return { msRemaining, expired, level: "red", label: `Vencida hace ${hm}` };
  const level = msRemaining <= 24 * 60 * 60 * 1000 ? "amber" : "green";
  return { msRemaining, expired, level, label: `Faltan ${hm}` };
}

export function buildAvisoMessage(
  tipo: AvisoTipo,
  ctx: { clienteNombre?: string | null; numeroColecta?: string | null; folio: string }
): string {
  const saludo = ctx.clienteNombre ? `Hola, ${ctx.clienteNombre}.` : "Hola.";
  const ref = ctx.numeroColecta && ctx.numeroColecta.trim() ? ctx.numeroColecta : ctx.folio;
  if (tipo === "LLEGO_TALLER") {
    return `${saludo} Le informamos que el material de la colecta ${ref} ya llegó de taller al almacén y está listo para preparar su empaque.`;
  }
  return `${saludo} Le informamos que el material de la colecta ${ref} ya está listo y preparado en almacén para su recolección.`;
}
```

- [ ] **Step 7: Correr pruebas para verificar que pasan**

Run: `npm test`
Expected: PASS — todas las pruebas verdes.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/colectas-logic.ts src/lib/colectas-logic.test.ts
git commit -m "feat: lógica pura de colectas (estados, 48h, avisos) + vitest"
```

---

### Task 4: Modelo de datos — Colecta, ColectaItem, ColectaAviso

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_colectas/migration.sql` (lo genera Prisma)

- [ ] **Step 1: Agregar relaciones inversas en modelos existentes**

En `prisma/schema.prisma`:

En `model Organization`, dentro del bloque de relaciones, agrega:
```prisma
  colectas   Colecta[]
```
En `model Warehouse`, agrega:
```prisma
  colectas       Colecta[]
```
En `model User`, agrega:
```prisma
  colectas      Colecta[]
  colectaAvisos ColectaAviso[]
```
En `model Product`, agrega:
```prisma
  colectaItems   ColectaItem[]
```

- [ ] **Step 2: Agregar los tres modelos nuevos al final del archivo**

```prisma
model Colecta {
  id              String   @id @default(uuid())
  folio           String
  ordenCompra     String?
  numeroColecta   String?
  numeroSolicitud String?
  metodoEntrega   String   @default("RECOLECCION")
  status          String   @default("CREADA")
  clienteNombre   String?

  tallerArrivedAt DateTime?
  prepDeadlineAt  DateTime?
  readyAt         DateTime?
  collectedAt     DateTime?

  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  warehouseId     String?
  warehouse       Warehouse?   @relation(fields: [warehouseId], references: [id])
  createdById     String
  createdBy       User         @relation(fields: [createdById], references: [id])
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  items  ColectaItem[]
  avisos ColectaAviso[]

  @@unique([folio, organizationId])
  @@index([organizationId])
  @@index([status])
}

model ColectaItem {
  id        String  @id @default(uuid())
  colectaId String
  colecta   Colecta @relation(fields: [colectaId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int

  @@index([colectaId])
}

model ColectaAviso {
  id          String   @id @default(uuid())
  colectaId   String
  colecta     Colecta  @relation(fields: [colectaId], references: [id], onDelete: Cascade)
  tipo        String
  mensaje     String
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())

  @@index([colectaId])
}
```

- [ ] **Step 3: Crear y aplicar la migración**

Run: `npx prisma migrate dev --name add_colectas`
Expected: crea las tablas `Colecta`, `ColectaItem`, `ColectaAviso`; regenera el cliente; "Your database is now in sync with your schema."

- [ ] **Step 4: Verificar tipos del cliente Prisma**

Run: `npx tsc --noEmit`
Expected: sin errores (los modelos nuevos existen en el cliente).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: modelos Colecta, ColectaItem, ColectaAviso"
```

---

### Task 5: Server actions — crear y consultar colectas

**Files:**
- Create: `src/app/actions/colectas.ts`

**Interfaces:**
- Consumes (Task 3): `nextFolio`, `COLECTA_STATUS`.
- Produces (Tasks 7, 8, 9, 10):
  - `createColecta(input: CreateColectaInput): Promise<Result<{ id: string }>>`
  - `getColectas(): Promise<Result<ColectaListRow[]>>`
  - `getColecta(id: string): Promise<Result<ColectaDetail>>`
  - `getOrdenesColectas(): Promise<Result<{ id: string; folio: string; ordenCompra: string | null; numeroColecta: string | null }[]>>`
  - `CreateColectaInput = { ordenCompra?: string; numeroColecta?: string; numeroSolicitud?: string; metodoEntrega: string; clienteNombre?: string; warehouseId: string; items: { productId: string; quantity: number }[] }`

- [ ] **Step 1: Implementar el archivo de actions (crear + consultas)**

Crea `src/app/actions/colectas.ts`:

```ts
// src/app/actions/colectas.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nextFolio } from "@/lib/colectas-logic";

export interface CreateColectaInput {
  ordenCompra?: string;
  numeroColecta?: string;
  numeroSolicitud?: string;
  metodoEntrega: string; // "RECOLECCION" | "ENVIO"
  clienteNombre?: string;
  warehouseId: string;
  items: { productId: string; quantity: number }[];
}

async function getSessionCtx() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: (session.user as any).id as string,
    userOrgId: (session.user as any).organizationId as string,
    userRole: (session.user as any).role as string,
  };
}

export async function createColecta(input: CreateColectaInput) {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  if (!input.warehouseId) return { success: false as const, error: "Selecciona un almacén" };
  if (!input.items.length) return { success: false as const, error: "Agrega al menos un producto" };
  if (input.items.some((i) => i.quantity <= 0)) {
    return { success: false as const, error: "Las cantidades deben ser mayores a 0" };
  }

  // El almacén define la organización de la colecta.
  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) return { success: false as const, error: "Almacén no encontrado" };
  if (ctx.userRole !== "ADMIN_GI" && warehouse.organizationId !== ctx.userOrgId) {
    return { success: false as const, error: "No autorizado para este almacén" };
  }
  const organizationId = warehouse.organizationId;

  try {
    const colecta = await prisma.$transaction(async (tx) => {
      const count = await tx.colecta.count({ where: { organizationId } });
      return tx.colecta.create({
        data: {
          folio: nextFolio(count),
          ordenCompra: input.ordenCompra?.trim() || null,
          numeroColecta: input.numeroColecta?.trim() || null,
          numeroSolicitud: input.numeroSolicitud?.trim() || null,
          metodoEntrega: input.metodoEntrega === "ENVIO" ? "ENVIO" : "RECOLECCION",
          clienteNombre: input.clienteNombre?.trim() || null,
          status: "CREADA",
          organizationId,
          warehouseId: input.warehouseId,
          createdById: ctx.userId,
          items: {
            create: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          },
        },
      });
    });

    revalidatePath("/colectas");
    return { success: true as const, data: { id: colecta.id } };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Folio duplicado, intenta de nuevo" };
    return { success: false as const, error: e.message ?? "Error al crear la colecta" };
  }
}

export async function getColectas() {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const where = ctx.userRole === "ADMIN_GI" ? {} : { organizationId: ctx.userOrgId };

  const colectas = await prisma.colecta.findMany({
    where,
    include: {
      warehouse: { select: { name: true } },
      organization: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { success: true as const, data: colectas };
}

export async function getColecta(id: string) {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const colecta = await prisma.colecta.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true } },
      organization: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true, price: true } } },
      },
      avisos: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!colecta) return { success: false as const, error: "Colecta no encontrada" };
  if (ctx.userRole !== "ADMIN_GI" && colecta.organizationId !== ctx.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  // Serializar Decimal (price) a número.
  const serialized = {
    ...colecta,
    items: colecta.items.map((it) => ({
      ...it,
      product: { ...it.product, price: it.product.price != null ? Number(it.product.price) : null },
    })),
  };

  return { success: true as const, data: serialized };
}

export async function getOrdenesColectas() {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const where = ctx.userRole === "ADMIN_GI" ? {} : { organizationId: ctx.userOrgId };

  const rows = await prisma.colecta.findMany({
    where,
    select: { id: true, folio: true, ordenCompra: true, numeroColecta: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return { success: true as const, data: rows };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/colectas.ts
git commit -m "feat: actions crear y consultar colectas"
```

---

### Task 6: Server actions — transiciones de ciclo de vida

Transiciones que aplican `validateTransition`, generan avisos y, al recolectar, descuentan inventario (patrón del POS).

**Files:**
- Modify: `src/app/actions/colectas.ts`

**Interfaces (produce — Task 9):**
- `transitionColecta(id: string, action: ColectaAction): Promise<Result<{ status: string }>>`

- [ ] **Step 1: Agregar imports de lógica al inicio de `colectas.ts`**

Reemplaza el import existente de `colectas-logic` por:

```ts
import {
  nextFolio,
  validateTransition,
  computeDeadline,
  buildAvisoMessage,
  type ColectaAction,
} from "@/lib/colectas-logic";
```

- [ ] **Step 2: Agregar la action `transitionColecta` al final del archivo**

```ts
export async function transitionColecta(id: string, action: ColectaAction) {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const colecta = await prisma.colecta.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!colecta) return { success: false as const, error: "Colecta no encontrada" };
  if (ctx.userRole !== "ADMIN_GI" && colecta.organizationId !== ctx.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const check = validateTransition(colecta.status, action);
  if (!check.ok) return { success: false as const, error: check.error };
  const next = check.next;

  try {
    await prisma.$transaction(async (tx) => {
      const data: any = { status: next };

      if (action === "LLEGO_TALLER") {
        const arrivedAt = new Date();
        data.tallerArrivedAt = arrivedAt;
        data.prepDeadlineAt = computeDeadline(arrivedAt);
      }
      if (action === "MARCAR_LISTA") {
        data.readyAt = new Date();
      }
      if (action === "MARCAR_RECOLECTADA") {
        data.collectedAt = new Date();
        if (!colecta.warehouseId) {
          throw new Error("La colecta no tiene almacén asignado");
        }
        // Descontar inventario y registrar una Salida por cada item (patrón POS).
        for (const item of colecta.items) {
          const inv = await tx.inventoryItem.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: colecta.warehouseId } },
            include: { product: { select: { name: true, unit: true } } },
          });
          const currentQty = inv?.quantity ?? 0;
          if (currentQty < item.quantity) {
            throw new Error(
              `Stock insuficiente para "${inv?.product?.name ?? item.productId}": hay ${currentQty} ${inv?.product?.unit ?? "uds"}`
            );
          }
          await tx.inventoryItem.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: colecta.warehouseId } },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              type: "EXIT",
              productId: item.productId,
              fromWarehouseId: colecta.warehouseId,
              toWarehouseId: null,
              quantity: item.quantity,
              reason: `Recolección ${colecta.folio}`,
              receiverName: colecta.clienteNombre ?? null,
              createdById: ctx.userId,
            },
          });
        }
      }

      await tx.colecta.update({ where: { id }, data });

      // Avisos in-system para llegada de taller y para "lista".
      if (action === "LLEGO_TALLER" || action === "MARCAR_LISTA") {
        const tipo = action === "LLEGO_TALLER" ? "LLEGO_TALLER" : "LISTA";
        const mensaje = buildAvisoMessage(tipo, {
          clienteNombre: colecta.clienteNombre,
          numeroColecta: colecta.numeroColecta,
          folio: colecta.folio,
        });
        await tx.colectaAviso.create({
          data: { colectaId: id, tipo, mensaje, createdById: ctx.userId },
        });
      }
    });

    revalidatePath("/colectas");
    revalidatePath(`/colectas/${id}`);
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true as const, data: { status: next } };
  } catch (e: any) {
    return { success: false as const, error: e.message ?? "Error al actualizar la colecta" };
  }
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación manual del flujo (servidor de desarrollo)**

Run: `npm run dev` y en otra terminal mantén la sesión iniciada en el navegador.
Comprobación (se hará completa en Task 9, aquí basta el typecheck). Detén el server con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/colectas.ts
git commit -m "feat: transiciones de colecta con avisos y descuento de inventario"
```

---

### Task 7: Navegación + página de lista de Colectas + cronómetro

**Files:**
- Modify: `src/components/sidebar.tsx`
- Create: `src/components/colectas/countdown.tsx`
- Create: `src/app/(app)/colectas/page.tsx`
- Create: `src/app/(app)/colectas/colectas-list.tsx`

**Interfaces:**
- Consumes (Tasks 3, 5): `getColectas`, `STATUS_LABELS`, `STATUS_BADGE`, `METODO_LABELS`, `getCountdownState`.
- Produces (Task 9 reusa `<Countdown deadlineISO=... />`).

- [ ] **Step 1: Agregar ítem "Colectas" al sidebar**

En `src/components/sidebar.tsx`, importa el icono `Truck` añadiéndolo a la lista de `lucide-react`:

```ts
  Truck,
```

Y en `navItems`, agrega tras "POS — Salidas":

```ts
  { label: "Colectas",            href: "/colectas",       icon: Truck },
```

- [ ] **Step 2: Crear el componente de cronómetro `countdown.tsx`**

```tsx
// src/components/colectas/countdown.tsx
"use client";

import { useEffect, useState } from "react";
import { getCountdownState } from "@/lib/colectas-logic";

const LEVEL_CLS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export function Countdown({ deadlineISO, className = "" }: { deadlineISO: string; className?: string }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (nowMs === null) return null; // evita desajuste de hidratación

  const s = getCountdownState(deadlineISO, nowMs);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${LEVEL_CLS[s.level]} ${className}`}>
      {s.label}
    </span>
  );
}
```

- [ ] **Step 3: Crear la página servidor de lista `colectas/page.tsx`**

```tsx
// src/app/(app)/colectas/page.tsx
import Link from "next/link";
import { getColectas } from "@/app/actions/colectas";
import { ColectasList } from "./colectas-list";
import { Plus, ArrowLeftRight } from "lucide-react";

export default async function ColectasPage() {
  const res = await getColectas();
  const colectas = res.success ? res.data : [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Colectas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Recolecciones de Mercado Pago / Mercado Libre</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/colectas/ordenes"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:border-primary/40 hover:text-primary transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Órdenes ↔ Colectas
          </Link>
          <Link
            href="/colectas/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva colecta
          </Link>
        </div>
      </div>

      <ColectasList colectas={colectas as any} />
    </div>
  );
}
```

- [ ] **Step 4: Crear el componente cliente de lista `colectas-list.tsx`**

```tsx
// src/app/(app)/colectas/colectas-list.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Inbox } from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE, METODO_LABELS, type ColectaStatus } from "@/lib/colectas-logic";
import { Countdown } from "@/components/colectas/countdown";

type Row = {
  id: string;
  folio: string;
  ordenCompra: string | null;
  numeroColecta: string | null;
  numeroSolicitud: string | null;
  metodoEntrega: string;
  status: string;
  prepDeadlineAt: string | Date | null;
  createdAt: string | Date;
  warehouse: { name: string } | null;
  organization: { name: string };
  _count: { items: number };
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "CREADA", label: "Creadas" },
  { value: "EN_PREPARACION", label: "En preparación" },
  { value: "LISTA", label: "Listas" },
  { value: "RECOLECTADA", label: "Recolectadas" },
];

export function ColectasList({ colectas }: { colectas: Row[] }) {
  const [filter, setFilter] = useState("");
  const rows = filter ? colectas.filter((c) => c.status === filter) : colectas;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === f.value
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Folio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">OC / # Colecta</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Método</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const status = c.status as ColectaStatus;
              return (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/colectas/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.folio}
                    </Link>
                    <p className="text-xs text-slate-400">{c._count.items} prod.</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>OC: {c.ordenCompra ?? "—"}</p>
                    <p className="text-slate-400">Col: {c.numeroColecta ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{METODO_LABELS[c.metodoEntrega] ?? c.metodoEntrega}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "EN_PREPARACION" && c.prepDeadlineAt ? (
                      <Countdown deadlineISO={new Date(c.prepDeadlineAt).toISOString()} />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(c.createdAt), "dd MMM yyyy", { locale: es })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin colectas</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar typecheck y arranque**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run dev`, abrir `/colectas`.
Expected: la página carga, aparece "Colectas" en el menú, la tabla muestra "Sin colectas" (aún no hay datos). Detener con Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/colectas/countdown.tsx "src/app/(app)/colectas/page.tsx" "src/app/(app)/colectas/colectas-list.tsx"
git commit -m "feat: navegación y lista de colectas con cronómetro"
```

---

### Task 8: Formulario de nueva colecta

**Files:**
- Create: `src/app/(app)/colectas/new/page.tsx`
- Create: `src/components/colectas/colecta-form.tsx`

**Interfaces:**
- Consumes (Tasks 5, 3): `createColecta`, `getProducts`/`getAllProducts`, `getWarehouses`/`getAllWarehouses`, `METODO_LABELS`.

- [ ] **Step 1: Crear la página servidor que carga productos y almacenes**

```tsx
// src/app/(app)/colectas/new/page.tsx
import { auth } from "@/lib/auth";
import { getProducts, getAllProducts } from "@/app/actions/products";
import { getWarehouses, getAllWarehouses } from "@/app/actions/warehouses";
import { ColectaForm } from "@/components/colectas/colecta-form";

export default async function NewColectaPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;
  const isAdmin = userRole === "ADMIN_GI";

  const [productsRes, warehousesRes] = await Promise.all([
    isAdmin ? getAllProducts() : getProducts(userOrgId),
    isAdmin ? getAllWarehouses() : getWarehouses(userOrgId),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Nueva colecta</h1>
      <p className="text-sm text-slate-500 mb-6">Captura los datos de la recolección y los productos a preparar.</p>
      <ColectaForm
        products={productsRes.success ? (productsRes.data as any) : []}
        warehouses={warehousesRes.success ? (warehousesRes.data as any) : []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Crear el formulario cliente con carrito de productos**

```tsx
// src/components/colectas/colecta-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createColecta } from "@/app/actions/colectas";
import { Plus, Minus, X, Loader2 } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Warehouse = { id: string; name: string; organization?: { name: string } };
type Line = { productId: string; name: string; unit: string; qty: number };

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export function ColectaForm({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const router = useRouter();
  const [ordenCompra, setOrdenCompra] = useState("");
  const [numeroColecta, setNumeroColecta] = useState("");
  const [numeroSolicitud, setNumeroSolicitud] = useState("");
  const [metodoEntrega, setMetodoEntrega] = useState("RECOLECCION");
  const [clienteNombre, setClienteNombre] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState(products[0]?.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addLine = () => {
    const p = products.find((x) => x.id === picker);
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) return;
    setLines([...lines, { productId: p.id, name: p.name, unit: p.unit, qty: 1 }]);
  };

  const updateQty = (productId: string, delta: number) =>
    setLines(lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, l.qty + delta) } : l)));

  const removeLine = (productId: string) => setLines(lines.filter((l) => l.productId !== productId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!warehouseId) { setError("Selecciona un almacén"); return; }
    if (!lines.length) { setError("Agrega al menos un producto"); return; }
    setLoading(true);

    const res = await createColecta({
      ordenCompra: ordenCompra || undefined,
      numeroColecta: numeroColecta || undefined,
      numeroSolicitud: numeroSolicitud || undefined,
      metodoEntrega,
      clienteNombre: clienteNombre || undefined,
      warehouseId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
    });

    if (!res.success) {
      setError(res.error ?? "Error al crear");
      setLoading(false);
    } else {
      router.push(`/colectas/${res.data.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}># Orden de compra</label>
          <input value={ordenCompra} onChange={(e) => setOrdenCompra(e.target.value)} className={inputCls} placeholder="OC-7781" />
        </div>
        <div>
          <label className={labelCls}># Colecta MP/ML</label>
          <input value={numeroColecta} onChange={(e) => setNumeroColecta(e.target.value)} className={inputCls} placeholder="ML-44920" />
        </div>
        <div>
          <label className={labelCls}># Solicitud / Entrega</label>
          <input value={numeroSolicitud} onChange={(e) => setNumeroSolicitud(e.target.value)} className={inputCls} placeholder="SOL-001" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Método de entrega</label>
          <select value={metodoEntrega} onChange={(e) => setMetodoEntrega(e.target.value)} className={inputCls + " cursor-pointer"}>
            <option value="RECOLECCION">Recolección</option>
            <option value="ENVIO">Envío</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Cliente / contacto</label>
          <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={inputCls} placeholder="Nombre de la clienta" />
        </div>
        <div>
          <label className={labelCls}>Almacén *</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className={inputCls + " cursor-pointer"}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}{w.organization ? ` — ${w.organization.name}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Productos *</label>
        <div className="flex gap-2">
          <select value={picker} onChange={(e) => setPicker(e.target.value)} className={inputCls + " cursor-pointer"}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ""}</option>
            ))}
          </select>
          <button type="button" onClick={addLine} className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {lines.length > 0 && (
          <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
            {lines.map((l) => (
              <div key={l.productId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-slate-700 truncate">{l.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => updateQty(l.productId, -1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer">
                    <Minus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 w-6 text-center tabular-nums">{l.qty}</span>
                  <button type="button" onClick={() => updateQty(l.productId, 1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer">
                    <Plus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-400 w-8">{l.unit}</span>
                  <button type="button" onClick={() => removeLine(l.productId)} className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>}

      <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Creando..." : "Crear colecta"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verificar typecheck y crear una colecta de prueba**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run dev`, ir a `/colectas/new`, llenar identificadores, elegir almacén, agregar un producto y crear.
Expected: redirige a `/colectas/[id]` (página vacía aún hasta Task 9) y la colecta aparece en `/colectas` con estado "Creada". Detener con Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/colectas/new/page.tsx" src/components/colectas/colecta-form.tsx
git commit -m "feat: formulario de nueva colecta"
```

---

### Task 9: Detalle de colecta — ciclo de vida, cronómetro y avisos

**Files:**
- Create: `src/app/(app)/colectas/[id]/page.tsx`
- Create: `src/components/colectas/colecta-detail.tsx`

**Interfaces:**
- Consumes (Tasks 3, 5, 6, 7): `getColecta`, `transitionColecta`, `STATUS_LABELS`, `STATUS_BADGE`, `METODO_LABELS`, `<Countdown />`.

- [ ] **Step 1: Crear la página servidor de detalle**

```tsx
// src/app/(app)/colectas/[id]/page.tsx
import { notFound } from "next/navigation";
import { getColecta } from "@/app/actions/colectas";
import { ColectaDetail } from "@/components/colectas/colecta-detail";

export default async function ColectaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getColecta(id);
  if (!res.success) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <ColectaDetail colecta={res.data as any} />
    </div>
  );
}
```

- [ ] **Step 2: Crear el componente cliente de detalle**

```tsx
// src/components/colectas/colecta-detail.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { transitionColecta } from "@/app/actions/colectas";
import { STATUS_LABELS, STATUS_BADGE, METODO_LABELS, type ColectaStatus, type ColectaAction } from "@/lib/colectas-logic";
import { Countdown } from "@/components/colectas/countdown";
import { Loader2, Copy, Check, PackageCheck, Bell } from "lucide-react";

type Item = { id: string; quantity: number; product: { name: string; sku: string | null; unit: string } };
type Aviso = { id: string; tipo: string; mensaje: string; createdAt: string | Date; createdBy: { name: string } };
type Colecta = {
  id: string;
  folio: string;
  ordenCompra: string | null;
  numeroColecta: string | null;
  numeroSolicitud: string | null;
  metodoEntrega: string;
  status: string;
  clienteNombre: string | null;
  prepDeadlineAt: string | Date | null;
  warehouse: { name: string } | null;
  organization: { name: string };
  createdBy: { name: string };
  createdAt: string | Date;
  items: Item[];
  avisos: Aviso[];
};

const ACTION_LABEL: Record<ColectaAction, string> = {
  LLEGO_TALLER: "Marcar llegada de taller",
  MARCAR_LISTA: "Marcar lista para recolección",
  MARCAR_RECOLECTADA: "Marcar recolectada",
  CANCELAR: "Cancelar colecta",
};

const NEXT_ACTION: Record<string, ColectaAction | null> = {
  CREADA: "LLEGO_TALLER",
  EN_PREPARACION: "MARCAR_LISTA",
  LISTA: "MARCAR_RECOLECTADA",
  RECOLECTADA: null,
  CANCELADA: null,
};

export function ColectaDetail({ colecta }: { colecta: Colecta }) {
  const router = useRouter();
  const [loading, setLoading] = useState<ColectaAction | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const status = colecta.status as ColectaStatus;
  const nextAction = NEXT_ACTION[colecta.status] ?? null;
  const canCancel = ["CREADA", "EN_PREPARACION", "LISTA"].includes(colecta.status);

  const run = async (action: ColectaAction) => {
    setError("");
    setLoading(action);
    const res = await transitionColecta(colecta.id, action);
    if (!res.success) setError(res.error ?? "Error");
    else router.refresh();
    setLoading(null);
  };

  const copy = async (aviso: Aviso) => {
    await navigator.clipboard.writeText(aviso.mensaje);
    setCopied(aviso.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{colecta.folio}</h1>
            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABELS[status] ?? colecta.status}
            </span>
            {colecta.status === "EN_PREPARACION" && colecta.prepDeadlineAt && (
              <Countdown deadlineISO={new Date(colecta.prepDeadlineAt).toISOString()} />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Creada {format(new Date(colecta.createdAt), "dd MMM yyyy · HH:mm", { locale: es })} por {colecta.createdBy.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {nextAction && (
            <button
              onClick={() => run(nextAction)}
              disabled={loading !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading === nextAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              {ACTION_LABEL[nextAction]}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => run("CANCELAR")}
              disabled={loading !== null}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading === "CANCELAR" ? "Cancelando..." : "Cancelar colecta"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>}

      {/* Datos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="# Orden de compra" value={colecta.ordenCompra ?? "—"} />
        <Field label="# Colecta MP/ML" value={colecta.numeroColecta ?? "—"} />
        <Field label="# Solicitud / Entrega" value={colecta.numeroSolicitud ?? "—"} />
        <Field label="Método de entrega" value={METODO_LABELS[colecta.metodoEntrega] ?? colecta.metodoEntrega} />
        <Field label="Cliente / contacto" value={colecta.clienteNombre ?? "—"} />
        <Field label="Almacén" value={colecta.warehouse?.name ?? "—"} />
      </div>

      {/* Productos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Productos a preparar</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {colecta.items.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-2.5">
                  <p className="text-slate-800">{it.product.name}</p>
                  {it.product.sku && <p className="text-xs text-slate-400 font-mono">{it.product.sku}</p>}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                  {it.quantity} <span className="font-normal text-slate-400">{it.product.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Avisos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Avisos a la clienta</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">El envío automático aún no está conectado: copia el texto y envíalo por tu canal habitual.</p>
        {colecta.avisos.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no se han generado avisos.</p>
        ) : (
          <div className="space-y-2.5">
            {colecta.avisos.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-500">
                    {a.tipo === "LLEGO_TALLER" ? "Llegó de taller" : "Lista para recolección"} ·{" "}
                    {format(new Date(a.createdAt), "dd MMM · HH:mm", { locale: es })}
                  </span>
                  <button onClick={() => copy(a)} className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                    {copied === a.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === a.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="text-sm text-slate-700">{a.mensaje}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck y recorrer el ciclo completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run dev`, abrir la colecta creada en Task 8 y recorrer:
1. "Marcar llegada de taller" → aparece cronómetro + un aviso "Llegó de taller" con botón Copiar.
2. "Marcar lista para recolección" → aparece segundo aviso "Lista para recolección".
3. "Marcar recolectada" → estado Recolectada; verificar en `/inventory` que el stock del producto bajó por la cantidad de la colecta.
Expected: cada paso avanza el estado; los avisos se generan; el inventario se descuenta al recolectar. Detener con Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/colectas/[id]/page.tsx" src/components/colectas/colecta-detail.tsx
git commit -m "feat: detalle de colecta con ciclo de vida, cronómetro y avisos"
```

---

### Task 10: Vista "Órdenes ↔ Colectas" (2 columnas)

**Files:**
- Create: `src/app/(app)/colectas/ordenes/page.tsx`

**Interfaces:**
- Consumes (Task 5): `getOrdenesColectas`.

- [ ] **Step 1: Crear la página de 2 columnas**

```tsx
// src/app/(app)/colectas/ordenes/page.tsx
import Link from "next/link";
import { getOrdenesColectas } from "@/app/actions/colectas";
import { ArrowLeft, Inbox } from "lucide-react";

export default async function OrdenesColectasPage() {
  const res = await getOrdenesColectas();
  const rows = res.success ? res.data : [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/colectas" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Órdenes ↔ Colectas</h1>
          <p className="text-sm text-slate-500 mt-0.5"># Orden de compra y su # de colecta asignado por MP/ML</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">N.° Orden de compra</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">N.° Colecta MP/ML</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/colectas/${r.id}`} className="text-slate-800 hover:text-primary hover:underline">
                    {r.ordenCompra ?? <span className="text-slate-300">—</span>}
                  </Link>
                  <p className="text-xs text-slate-400">{r.folio}</p>
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {r.numeroColecta ?? <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin colectas</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck y vista**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run dev`, abrir `/colectas/ordenes`.
Expected: tabla de 2 columnas (OC ↔ # Colecta) con las colectas registradas. Detener con Ctrl+C.

- [ ] **Step 3: Build final de verificación**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: pruebas verdes, sin errores de tipos, build exitoso.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/colectas/ordenes/page.tsx"
git commit -m "feat: vista Órdenes ↔ Colectas de 2 columnas"
```

---

## Notas de cierre

- **Documentos de Karla (punto 6):** pendiente; se diseñará tras la reunión. El modelo `Colecta` está listo para agregarle una relación `ColectaDocumento[]` y una sección en el detalle sin reestructurar.
- **Envío real de avisos:** v1 solo genera y registra el texto. Para conectar correo/WhatsApp se agregará un servicio que consuma `ColectaAviso.mensaje`; la UI ya comunica que el envío es manual por ahora.
- **Folio concurrente:** `nextFolio` usa un conteo dentro de transacción; el `@@unique([folio, organizationId])` protege contra duplicados y la action reintenta-informa si choca (`P2002`).
