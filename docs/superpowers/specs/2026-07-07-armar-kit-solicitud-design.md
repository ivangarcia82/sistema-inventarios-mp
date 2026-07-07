# Diseño: "Armar kit" en la solicitud

Fecha: 2026-07-07
Estado: aprobado (diseño)

## Contexto y objetivo

Tras desglosar los kits en piezas individuales (mochila, gorra, lanyard, playera por
talla), al crear una **solicitud** (colecta) el usuario ya no puede pedir "un kit" como
tal. Este cambio agrega la acción **"Armar kit"** en el formulario de solicitud: pides
N kits, eliges la talla de playera, y el sistema arma las piezas por debajo.

Regla de negocio: **un kit = 1 mochila + 1 gorra + 2 lanyard + 1 playera** (la playera
la elige el usuario; el resto es fijo).

Flujo actual relevante:
- `createColecta` (`src/app/actions/colectas.ts`) crea la colecta con `ColectaItem`s
  `{productId, quantity}`. **No** descuenta inventario.
- `transitionColecta(..., "MARCAR_RECOLECTADA")` descuenta inventario y registra una
  Salida (`StockMovement` EXIT) por cada `ColectaItem`.

## Decisión de modelo

Se representa el kit **etiquetando las piezas** con un id de grupo, en vez de una tabla
nueva. Así el descuento al recolectar no cambia (son piezas normales); solo se agrupan
para mostrar.

`ColectaItem` gana dos campos opcionales:
- `kitGroupId String?` — mismo valor para las 4 piezas de un kit (uuid por línea de kit).
- `kitLabel String?` — etiqueta legible, p. ej. `"Kit — Playera Hombre Grande"`.

Piezas sueltas: ambos `null`. Migración: `ALTER TABLE "ColectaItem" ADD COLUMN ...` (2 columnas nullable).

Alternativa descartada: tabla `ColectaKit`. Más explícita pero duplica la lógica de
descuento y suma más código (YAGNI).

## Receta del kit (configuración)

Constantes en el servidor (no configurable por UI, por ahora):
- Mochila: producto de la org con nombre `"Mochila"`, cantidad 1 por kit.
- Gorra: producto `"Gorra"`, cantidad 1.
- Lanyard: producto `"Lanyard"`, cantidad 2.
- Playera: la elige el usuario (producto de playera de kit), cantidad 1.

Playeras de kit (para el dropdown): productos de la org cuyo nombre empieza con
`"Playera "` y **no** contiene `"Dry-fit"` (los creados por `decompose-kits-karla`:
Playera Hombre Grande, Hombre Mediana, Hombre Grande XL, Mujer Grande, Mujer Chica, Mujer XL).

## Cambios por componente

### 1. Prisma / migración
- `ColectaItem`: `kitGroupId String?`, `kitLabel String?`. Índice opcional en `kitGroupId`.
- Nueva migración `*_add_colectaitem_kit`.

### 2. `createColecta` (server action)
- Input gana `kits?: { playeraProductId: string; quantity: number }[]`.
- Para cada kit:
  - Valida que `playeraProductId` sea una playera de kit de la org y `quantity > 0`.
  - Resuelve por nombre los productos Mochila/Gorra/Lanyard de la org (si falta alguno → error claro).
  - Genera `kitGroupId = crypto.randomUUID()` y `kitLabel = "Kit — <nombre playera>"`.
  - Crea 4 `ColectaItem` etiquetados: mochila N, gorra N, lanyard 2N, playera N.
- Los `items` sueltos existentes siguen igual (sin tag).
- Validación: la colecta necesita al menos un item o un kit.

### 3. `ColectaForm` (cliente)
- Nueva sección "Armar kit": `select` de playera de kit + input cantidad + botón "Agregar kit".
- Estado nuevo `kits: { playeraProductId, playeraName, qty }[]` aparte de `lines`.
- Render: cada kit como una fila agrupada **"Kit ×N — Playera Hombre Grande"**, con las
  piezas listadas debajo en gris (1 mochila, 1 gorra, 2 lanyard, 1 playera) × N. Con
  controles +/- y eliminar. Los productos sueltos se muestran como hoy.
- Al enviar: manda `items` (sueltos) y `kits` (para que el server expanda).
- Recibe la lista de playeras de kit como prop (nueva) desde `colectas/new/page.tsx`.

### 4. Visualización agrupada
- **Detalle de colecta** (`getColecta` + `colecta-detail.tsx`): agrupar `items` por
  `kitGroupId`. Grupo → una fila "Kit ×N — <kitLabel>" (N = cantidad de la playera del
  grupo), expandible a piezas. Items sin `kitGroupId` → filas normales.
- **Remisión** (`src/lib/generate-remision.ts`): misma agrupación; el kit sale como una
  línea "Kit ×N — <playera>" en el PDF.
- `getColecta` ya incluye los items; solo hay que exponer `kitGroupId`/`kitLabel`.

### 5. Descuento al recolectar
- Sin cambios. `transitionColecta` descuenta cada `ColectaItem` (las piezas del kit se
  descuentan solas). El movimiento de Salida queda por pieza.

## Casos borde y decisiones
- **Sin validación de stock al crear** la solicitud (igual que hoy). El check real ocurre
  al marcar "Recolectada". Opcional: mostrar el stock disponible de cada playera como pista
  en el dropdown.
- **Playera sin stock**: se puede armar el kit igual (se valida al recolectar).
- **Productos Mochila/Gorra/Lanyard faltantes**: `createColecta` regresa error claro
  ("Falta el producto 'Mochila' en el catálogo"). En la práctica los crea `decompose-kits-karla`.
- **Kits legacy**: los 8 "Kit Para Representantes - talla" quedan en stock 0, solo para
  historial. El nuevo flujo no los referencia.

## Fuera de alcance
- Sistema general de recetas de kits configurables por UI.
- Editar la composición del kit (mochila/gorra/lanyard) desde la app.
- Validación/reserva de stock en el momento de crear la solicitud.

## Pruebas
- Unit: expansión de kit en `createColecta` (N kits → items correctos y etiquetados).
- Unit: agrupación por `kitGroupId` para el detalle/remisión (N = qty de la playera).
- Integración: crear colecta con 1 kit + 1 producto suelto → marcar Recolectada →
  inventario descuenta mochila/gorra/lanyard/playera + el producto suelto.
- Borde: kit con playera sin stock → falla al recolectar con error de stock, no al crear.
