# Diseño — Módulo de Colectas (Recolecciones MP/ML)

**Fecha:** 2026-06-23
**Proyecto:** sistema-inventarios-mp
**Estado:** Aprobado para planeación

## Contexto

La plataforma es un sistema de inventarios (Next.js 16 + Prisma + Postgres) con:
Organizaciones → Almacenes → Productos → Inventario, e historial de **Movimientos**
(Entrada, Salida, Transferencia, Devolución). Roles: `ADMIN_GI` y `USER_MP`.

El trabajo con Mercado Pago / Mercado Libre se organiza alrededor de **colectas**
(recolecciones): MP/ML pasa por el material al almacén. Hoy no existe ese concepto en
el sistema; estos cambios lo introducen como un módulo nuevo y aislado que reutiliza la
lógica de inventario existente.

No existe infraestructura de correo/WhatsApp ni de subida de archivos.

## Objetivos (mapeo de los 9 puntos del cliente)

| # | Punto del cliente | Cómo se resuelve |
|---|---|---|
| 1 | Valor monetario para inventarios | Ya implementado (`Product.price` + tarjeta "Valor inventario"). Se conserva y verifica. |
| 2 | Campo para # solicitudes / # entrega | Campo `numeroSolicitud` en la Colecta (3er identificador). |
| 3 | Un campo para cambiar envíos por recolecciones | Campo `metodoEntrega` (Recolección / Envío), por defecto Recolección. |
| 4 | Página de 2 columnas: # Orden de compra ↔ # Colecta | Vista "Órdenes ↔ Colectas" derivada automáticamente de las colectas. |
| 5 | "Devoluciones" → "Retiros" | Renombrado de etiqueta en toda la UI y la remisión PDF. |
| 6 | Documentos de Karla por colecta | **Fuera de alcance en esta iteración** (pendiente reunión). Modelo preparado para extenderlo. |
| 7 | Aviso a clienta: material listo para recolección | Aviso v1 in-system (texto generado + copiar + registro). |
| 8 | Aviso a clienta: material llegó de taller al almacén | Aviso v1 in-system (texto generado + copiar + registro). |
| 9 | Cronómetro 48h + fecha automática | `prepDeadlineAt = tallerArrivedAt + 48h`, cuenta regresiva en vivo. |

## No-objetivos (fuera de alcance)

- **Documentos de Karla (punto 6):** se diseña por separado tras la reunión del 2026-06-23.
  El modelo de datos se deja preparado para colgar una tabla `ColectaDocumento` sin
  reestructurar.
- **Envío real de avisos** por correo/WhatsApp. v1 solo genera el texto y registra el aviso
  dentro del sistema; el envío real se conecta en una iteración posterior sin rehacer la UI.

## Enfoque elegido

**Módulo Colecta propio** (entidad + pantallas nuevas) que reutiliza la lógica de
`createMovement` para descontar inventario al recolectar.

Alternativas descartadas:
- *Reusar StockMovement:* mezcla conceptos, no modela bien varios productos por colecta ni
  el ciclo de vida con cronómetro/avisos.
- *Tablas sueltas sin entidad central:* complica avisos y cronómetro.

## Modelo de datos (Prisma)

Nuevos modelos. Sigue las convenciones existentes (uuid, `@default(now())`, relaciones a
`Organization`/`Warehouse`/`User`/`Product`).

```prisma
model Colecta {
  id              String   @id @default(uuid())
  folio           String   // interno, auto: "COL-0001" por organización
  ordenCompra     String?  // # Orden de compra (MP)
  numeroColecta   String?  // # Colecta asignado por equipo MP/ML
  numeroSolicitud String?  // # Solicitud / # Entrega
  metodoEntrega   String   @default("RECOLECCION") // "RECOLECCION" | "ENVIO"
  status          String   @default("CREADA")
  // "CREADA" | "EN_PREPARACION" | "LISTA" | "RECOLECTADA" | "CANCELADA"
  clienteNombre   String?  // contacto de la clienta para el texto de avisos

  tallerArrivedAt DateTime? // marca "llegó de taller" → arranca 48h
  prepDeadlineAt  DateTime? // = tallerArrivedAt + 48h (fecha límite automática)
  readyAt         DateTime? // marca "LISTA"
  collectedAt     DateTime? // marca "RECOLECTADA"

  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  warehouseId     String?      // almacén donde se prepara / del que sale
  warehouse       Warehouse?   @relation(fields: [warehouseId], references: [id])
  createdById     String
  createdBy       User         @relation(fields: [createdById], references: [id])
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  items  ColectaItem[]
  avisos ColectaAviso[]
  // documentos ColectaDocumento[]  // futuro (punto 6)

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
  tipo        String   // "LLEGO_TALLER" | "LISTA"
  mensaje     String   // texto generado para enviar a la clienta
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())

  @@index([colectaId])
}
```

Relaciones inversas a agregar en modelos existentes: `Colecta[]` en `Organization`,
`Warehouse`, `User`, `Product`; `ColectaItem[]` en `Product`; `ColectaAviso[]` en `User`.

## Ciclo de vida y transiciones

```
CREADA ──"llegó de taller"──▶ EN_PREPARACION ──"marcar lista"──▶ LISTA ──"recolectada"──▶ RECOLECTADA
```

Acción de cancelar disponible desde cualquier estado no terminal → `CANCELADA`.

| Acción | Estado origen → destino | Efectos |
|---|---|---|
| Crear colecta | — → `CREADA` | Captura identificadores, método, cliente, productos; asigna folio. |
| Marcar llegada de taller | `CREADA` → `EN_PREPARACION` | Set `tallerArrivedAt = now`; `prepDeadlineAt = now + 48h`; crea `ColectaAviso(LLEGO_TALLER)` con texto generado. |
| Marcar lista | `EN_PREPARACION` → `LISTA` | Set `readyAt = now`; crea `ColectaAviso(LISTA)` con texto generado. |
| Marcar recolectada | `LISTA` → `RECOLECTADA` | Set `collectedAt = now`; **genera Salidas de inventario y descuenta stock** para cada `ColectaItem` (transacción única, reutiliza la lógica de `createMovement`/`createBatchMovements`). |
| Cancelar | cualquiera salvo `RECOLECTADA` → `CANCELADA` | Sin efecto en inventario. |

**Regla de inventario:** al recolectar, por cada item se crea un `StockMovement` tipo
`EXIT` desde `warehouseId`, con `reason = "Recolección <folio>"` y se descuenta el
inventario en la misma transacción. Si algún producto no tiene stock suficiente, la
transacción falla completa y la colecta no cambia de estado (mismo patrón que el POS).

**Decisión pendiente menor (resolver en planeación):** ¿el paso "llegó de taller" y
"preparando" deben ser dos clics separados? El diseño los une en `EN_PREPARACION` porque
las 48h de preparación arrancan al llegar de taller. Si el cliente quiere separarlos, se
añade un estado `RECIBIDA` previo.

## Cronómetro 48h (punto 9)

- La fecha límite es `prepDeadlineAt`, calculada automáticamente al marcar llegada de taller.
- En el detalle y en la lista, mientras el estado sea `EN_PREPARACION`, se muestra una
  **cuenta regresiva en vivo** calculada en cliente desde `prepDeadlineAt`:
  - Verde: faltan > 24h
  - Ámbar: faltan ≤ 24h
  - Rojo: ya pasó la fecha límite (vencida)
- Se muestra también la fecha límite explícita (ej. "Límite: 25 jun 2026 · 14:30").

## Avisos a la clienta — v1 in-system (puntos 7, 8)

Al disparar cada transición correspondiente, se crea un `ColectaAviso` con texto generado:

- **LLEGO_TALLER:** *"Hola{ , <cliente>}. Le informamos que el material de la colecta
  {<numeroColecta> | <folio>} ya llegó de taller al almacén y está listo para preparar su
  empaque."*
- **LISTA:** *"Hola{ , <cliente>}. Le informamos que el material de la colecta
  {<numeroColecta> | <folio>} ya está listo y preparado en almacén para su recolección."*

En el detalle de la colecta se listan los avisos generados con **botón de copiar** y la
fecha/usuario que lo generó. (El envío real por correo/WhatsApp es trabajo posterior.)

## Pantallas y navegación

Nuevo ítem en el sidebar: **"Colectas"** (icono de paquete/camión).

1. **`/colectas`** — Lista de colectas: folio, identificadores, método, estado (badge),
   cronómetro si aplica. Filtros por estado. Botón "Nueva colecta".
2. **`/colectas/ordenes`** (punto 4) — Vista "Órdenes ↔ Colectas": tabla de 2 columnas
   (# Orden de compra ↔ # Colecta MP/ML) derivada de las colectas existentes. Solo lectura.
   Puede implementarse como pestaña dentro de `/colectas` o página propia.
3. **`/colectas/new`** — Formulario de nueva colecta: identificadores, método de entrega,
   cliente, almacén, y selección de productos + cantidades (estilo carrito del POS).
4. **`/colectas/[id]`** — Detalle: datos, productos, línea de tiempo del ciclo de vida con
   botones de acción según estado, cronómetro, y lista de avisos con copiar.

## Renombrados (punto 5)

"Devolución/Devoluciones" → "Retiro/Retiros" en:
- `src/components/pos/movement-form.tsx` (label del tipo RETURN)
- `src/app/(app)/movements/page.tsx` (typeConfig + filtros)
- `src/app/(app)/dashboard/page.tsx` (movementTypeConfig + chartData)
- `src/lib/generate-remision.ts` (si mapea el tipo a texto)

El valor interno del tipo (`RETURN`) **no cambia**; solo la palabra visible.

## Permisos

Sigue el patrón existente:
- `USER_MP` y `ADMIN_GI` pueden crear/gestionar colectas en su organización.
- `ADMIN_GI` sin org explícita ve colectas de todas las organizaciones.
- Toda acción valida sesión y pertenencia a la organización del producto/almacén.

## Capas de implementación (para el plan)

1. **Renombrados + verificación de valor monetario** (rápido, sin migración).
2. **Modelo de datos** (`Colecta`, `ColectaItem`, `ColectaAviso`) + migración Prisma +
   relaciones inversas.
3. **Server actions** (`src/app/actions/colectas.ts`): crear, listar, obtener, transiciones
   de estado (con generación de avisos y descuento de inventario al recolectar).
4. **Pantallas**: lista, nueva, detalle (con cronómetro y avisos), vista Órdenes ↔ Colectas.
5. **Navegación**: ítem en sidebar.

## Testing

- Transiciones de estado: cada transición solo procede desde el estado correcto; cancelar
  no afecta inventario.
- Cronómetro: `prepDeadlineAt` = `tallerArrivedAt` + 48h exactas.
- Recolección: descuenta stock correcto por item; falla atómica si falta stock; crea
  `StockMovement` EXIT por item.
- Avisos: se crea exactamente un `ColectaAviso` por transición LLEGO_TALLER y LISTA, con el
  texto correcto.
- Permisos: `USER_MP` no accede a colectas de otra organización.

## Riesgos / consideraciones

- **Folio secuencial por organización:** requiere generar el consecutivo de forma segura
  (contar/contador dentro de transacción) para evitar duplicados en creación concurrente.
- **Documentos (punto 6):** decisión de almacenamiento (servidor propio vs nube) pendiente;
  el modelo queda preparado pero no se implementa.
- **Avisos:** al ser v1 in-system, el operador debe copiar/enviar manualmente; se debe
  comunicar claramente en la UI que el envío no es automático todavía.
