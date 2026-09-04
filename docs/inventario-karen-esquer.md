# Inventario de Karen Esquer (aislamiento por almacén)

Carga del archivo `ultimoinventario.xlsx` para **Karen Esquer**, dentro de la
organización **Mercado Pago**, pero sin que ella vea el inventario de Karla ni
Karla el de ella.

## El problema

Hasta ahora el aislamiento del sistema era **por organización**: `getInventory`,
`getProducts`, `getWarehouses` y `getColectas` filtraban por `organizationId`, así
que dos usuarios de la misma organización veían exactamente lo mismo. Poner a
Karen en la org Mercado Pago le habría mostrado los 31 productos de Karla.

## La solución: almacén asignado por usuario

Campo nuevo **`User.warehouseId`** (migración `20260904000000_add_user_warehouse`).

- `null` → el usuario ve toda su organización (comportamiento anterior).
- Con valor → el usuario **solo** ve ese almacén.
- Los `ADMIN_GI` ignoran el campo: siempre ven todo.

La lógica de los filtros vive en `src/lib/scope-logic.ts` (pura, con pruebas en
`src/lib/scope-logic.test.ts`) y el wrapper de sesión en `src/lib/scope.ts`.
`getScope()` lee la asignación **de la base, no del JWT**, para que un cambio
aplique de inmediato sin volver a iniciar sesión.

| Consulta | Con almacén asignado |
|---|---|
| `getInventory` / `getInventorySummary` | solo filas de ese almacén |
| `getProducts` | solo productos con inventario en ese almacén |
| `getWarehouses` | solo ese almacén |
| `getColectas` / `getColecta` / `getOrdenesColectas` / `transitionColecta` | solo colectas de ese almacén |
| `getMovements` | solo movimientos que entran o salen de ese almacén |
| `createColecta` | rechaza cualquier otro almacén |

Un producto agotado **no** desaparece del catálogo: el filtro es "tiene fila de
inventario en mi almacén", y esa fila persiste aunque la cantidad llegue a 0.

## Administración

En **Usuarios** hay un selector *Almacén asignado* al crear (se limita a los
almacenes de la organización elegida y se desactiva para Admin GI) y una columna
editable en línea para reasignarlo después (`setUserWarehouse`).

## Datos cargados

| | |
|---|---|
| Usuario | Karen Esquer — `karen.esquersalazar@mercadolibre.com.mx` / `karen123` (rol `USER_MP`) |
| Almacén | Almacén Karen Esquer (org Mercado Pago) |
| Materiales | 19 productos, `sku` = clave PV del Excel |
| Inventario | columna **DISPONIBLE** = 57,551 piezas |
| Movimientos | **ninguno** (decisión acordada: "Solo DISPONIBLE") |

`RECIBIDO` y `SALIDAS` se conservan en la `description` de cada producto como
referencia. Los 19 renglones cuadran: `RECIBIDO − SALIDAS = DISPONIBLE`
(79,170 − 21,619 = 57,551).

Además, **Karla queda restringida a "Almacén Mercado Pago"**. Verificado contra
producción: sus 31 productos / 2,278 piezas ya están todos en ese almacén, así
que no pierde nada.

## Runbook

La migración se aplica sola en el deploy de Vercel (`prisma migrate deploy`).
**Después del deploy**, correr el script (dry-run por defecto):

```bash
DATABASE_URL="<unpooled>" npx tsx scripts/import-inventario-karen.ts           # dry-run
DATABASE_URL="<unpooled>" npx tsx scripts/import-inventario-karen.ts --apply   # escribe
```

Es idempotente: busca productos por nombre dentro de la org y fija el inventario
de forma absoluta, así que se puede repetir sin duplicar.

## Verificado antes de escribir (solo lectura contra producción)

- 0 colisiones de nombre entre los 19 materiales y los 31 productos actuales.
- `Almacén Karen Esquer` y el correo de Karen no existían.
- Karla no pierde inventario al quedar restringida.
- 34 pruebas en verde, `tsc --noEmit` limpio, `next build` exitoso.

## Nota sobre los nombres

Los nombres se toman del Excel con un cambio mínimo (espacios colapsados y
mayúscula inicial), para no alterar cómo la clienta llama a cada material.
Quedaron sin corregir, a la espera de que ella confirme:
`Lanyar consultor` (¿Lanyard?), `Chupon plastico` (¿Chupón plástico?),
`Boligrafos` (¿Bolígrafos?), `Sticker aceptamos tarjetas debico/credito`
(¿débito/crédito?), `Playera N M/consultor Cab` y `Playera N G/consultor Cab`.
