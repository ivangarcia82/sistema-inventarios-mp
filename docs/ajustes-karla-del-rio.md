# Ajustes usuario Karla del Río

Cambios solicitados por la clienta (Mercado Pago) para el usuario **Karla del Río**.

## Qué incluye este PR

### Código (se aplica al desplegar a Vercel)
1. **Costo por producto** — nuevo campo `Product.cost`.
   - Formulario **Productos** con campo *Costo*, columna *Costo* y edición en línea de Costo/Precio.
   - Inventario muestra columna *Costo* y el *Valor total a costo*.
2. **Volumen en piezas de los Kit** — nuevo campo `Product.piecesPerUnit` (default 1).
   - El Kit se cuenta como **unidad "kit"** (no se multiplica el inventario) y el volumen
     en piezas se muestra como **dato derivado** (cantidad × piecesPerUnit) en Inventario.
   - Editable en Productos ("Pzas/u"). Migración `20260706000000_add_product_cost_and_pieces`.
3. **Ocultar "Nuevo movimiento" para usuarios Mercado Pago** (rol `USER_MP`, incl. Karla).
   - Se oculta del menú + guarda de servidor en `/movements/new` y en `createMovement`
     (el POS de salidas sigue funcionando).

### Datos (scripts idempotentes — correr con `--apply` DESPUÉS del deploy)
Todos aceptan dry-run (sin `--apply` = no escribe). Requieren `DATABASE_URL` a la base.

```bash
# 1) Usuario admin de Iván (ADMIN_GI, puede registrar movimientos)
npx tsx scripts/create-user-ivan.ts --apply

# 2) Consolidar almacenes de la org Mercado Pago -> deja solo 2:
#    "Almacén Mercado Pago" (fusiona FULL 1 + FULL 2) y "Almacén GI" (vacío).
#    Oficina CDMX se DESCARTA (solo tenía movimientos de prueba de Karla).
npx tsx scripts/consolidate-warehouses-mp.ts --apply

# 3) Configurar Kits: unidad "kit" + piecesPerUnit=5 (excluye Kit Señalización).
npx tsx scripts/setup-kits-karla.ts --apply

# 4) Costos por producto (reglas del Excel de costos de la clienta):
#      Kit Representantes $724 | Playera Dry-fit $249.50 | Rompevientos $416 (L/S/XL)
#      Pack 4 Cordones $140 | Pack Manuales y Kit Señalización = pendientes
npx tsx scripts/import-costs-karla.ts --apply
```

**Orden recomendado:** 1 → 2 → 3 → 4.

## Costos (per componente del Excel → resueltos por producto)
| Componente | Costo |
|---|---|
| Mochila | $335 |
| Gorra | $69.50 |
| Playera Dry-fit | $249.50 |
| Lanyard | $35 |
| Rompevientos | $416 |

- **Kit Representantes** = mochila + gorra + playera + 2·lanyard = **$724**.
- **Pack De 4 Cordones** = 4 × lanyard = **$140**.
- **Pendientes (sin costo):** Pack De Manuales, Kit Señalización.

## Configuración de los scripts (env opcional)
- `KIT_PIECES` (default `5`), `KIT_EXCLUDE` (default `Kit Señalización`).
- `DISCARD_WAREHOUSES` (default `Oficina CDMX`) — almacenes a borrar en vez de fusionar.

## Idempotencia
- **create-user**: si el correo existe, lo conserva.
- **consolidate**: al re-correr ya no hay almacenes extra → no-op.
- **setup-kits / import-costs**: fijan valores absolutos.

## Verificado (dry-run de solo lectura contra producción)
- Almacenes: FULL 1 (807) + FULL 2 (455) → Almacén Mercado Pago (1,262); Oficina CDMX (21, prueba) descartada; Almacén GI vacío.
- Kits: 8 "Kit Para Representantes" → unidad kit, 5 pzas c/u, $724.
- Costos: 20 productos con costo, 2 pendientes, 0 sin regla.
