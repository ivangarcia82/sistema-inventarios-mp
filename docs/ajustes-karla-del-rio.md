# Ajustes usuario Karla del Río

Cambios solicitados por la clienta (Mercado Pago) para el usuario **Karla del Río**.

## Qué incluye este PR

### Código (se aplica al desplegar a Vercel)
1. **Costo por producto** — nuevo campo `Product.cost` (migración `20260706000000_add_product_cost`).
   - Formulario **Productos** con campo *Costo*, columna *Costo* y edición en línea de Costo/Precio.
   - Inventario muestra columna *Costo* y el *Valor total a costo*.
2. **Ocultar "Nuevo movimiento" para usuarios Mercado Pago** (rol `USER_MP`, incl. Karla).
   - Se oculta del menú lateral.
   - Guarda de servidor: la ruta `/movements/new` redirige y la acción `createMovement` rechaza a los `USER_MP`. (El POS de salidas sigue funcionando.)

### Datos (scripts idempotentes — correr con `--apply` DESPUÉS del deploy)
Todos aceptan dry-run (sin `--apply` = no escribe). Requieren `DATABASE_URL` apuntando a la base.

```bash
# 1) Usuario admin de Iván (ADMIN_GI, puede registrar movimientos)
npx tsx scripts/create-user-ivan.ts --apply

# 2) Consolidar almacenes de la org Mercado Pago -> deja solo 2:
#    "Almacén Mercado Pago" (fusiona FULL 1 + FULL 2) y "Almacén GI" (vacío).
#    Oficina CDMX se DESCARTA (solo tenía movimientos de prueba de Karla).
npx tsx scripts/consolidate-warehouses-mp.ts --apply

# 3) Kits -> piezas: cada "Kit" = 5 piezas (1 mochila + 1 gorra + 1 playera + 2 lanyard).
#    Excluye "Kit Señalización" (es señalización, no kit de ropa). Solo inventario.
npx tsx scripts/kits-to-pieces.ts --apply

# 4) Costos por producto (PENDIENTE: falta el Excel de costos de la clienta).
#    Generar scripts/costs-karla.data.json a partir del Excel y luego:
npx tsx scripts/import-costs-karla.ts --apply
```

**Orden recomendado:** 1 → 2 → 3 → (4 cuando llegue el Excel).

## Configuración de los scripts (env opcional)
- `KIT_MULT` (default `5`), `KIT_EXCLUDE` (default `Kit Señalización`).
- `DISCARD_WAREHOUSES` (default `Oficina CDMX`) — almacenes a borrar en vez de fusionar.

## Idempotencia
- **create-user**: si el correo existe, lo conserva.
- **consolidate**: al re-correr ya no hay almacenes extra → no-op.
- **kits-to-pieces**: registra un movimiento de ajuste como marca; no vuelve a multiplicar.
- **import-costs**: fija `cost` de forma absoluta.

## Pendiente
- [ ] Excel de costos de la clienta → `scripts/costs-karla.data.json` (2 productos van sin costo por ahora).
