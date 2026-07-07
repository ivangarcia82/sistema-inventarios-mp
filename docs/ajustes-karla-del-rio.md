# Ajustes usuario Karla del Río

Cambios solicitados por la clienta (Mercado Pago) para el usuario **Karla del Río**.

## Qué incluye este PR

### Código (se aplica al desplegar a Vercel)
1. **Costo por producto** — nuevo campo `Product.cost` (migración `20260706000000_add_product_cost`).
   - Formulario **Productos** con campo *Costo*, columna *Costo* y edición en línea de Costo/Precio.
   - Inventario muestra columna *Costo* y el *Valor total a costo*.
2. **Karla (rol `USER_MP`) sin "Nuevo movimiento" ni "POS — Salidas"**.
   - Ocultos del menú + guardas de servidor en `/movements/new`, `/pos`,
     `createMovement` y `createBatchMovements`. Solo admin GI puede mover/registrar salidas.

### Datos (scripts idempotentes — correr con `--apply` DESPUÉS del deploy)
Todos aceptan dry-run (sin `--apply` = no escribe). Requieren `DATABASE_URL` a la base.

```bash
# 1) Usuario admin de Iván (ADMIN_GI)
npx tsx scripts/create-user-ivan.ts --apply

# 2) Consolidar almacenes MP -> deja "Almacén Mercado Pago" (fusiona FULL 1+2) y
#    "Almacén GI" (vacío). Oficina CDMX se DESCARTA (movimientos de prueba de Karla).
npx tsx scripts/consolidate-warehouses-mp.ts --apply

# 3) Desglosar kits en piezas individuales (hoja "Desgloce 7226075"):
#    cada kit -> 1 mochila + 1 gorra + 2 lanyard + 1 playera (producto separado por talla).
#    El producto kit queda en 0 (se conserva para el historial).
npx tsx scripts/decompose-kits-karla.ts --apply

# 4) Costos por producto (reglas del Excel de costos):
npx tsx scripts/import-costs-karla.ts --apply
```

**Orden recomendado:** 1 → 2 → 3 → 4.

## Desglose del kit (hoja "Desgloce 7226075")
Cada "Kit Para Representantes - (talla)" = 1 mochila + 1 gorra + 2 lanyard + 1 playera.
Las playeras de kit son productos **separados** de las "Playera Dry-fit ..." sueltas.

| Pieza (producto) | Costo |
|---|---|
| Mochila | $335 |
| Gorra | $69.50 |
| Lanyard | $35 |
| Playera Hombre Grande / Mediana / Grande XL | $249.50 |
| Playera Mujer Grande / Chica / XL | $249.50 |

Tras consolidar+descartar Oficina CDMX: 254 kits → 254 mochila, 254 gorra, 508 lanyard,
y las playeras por talla (146 H-Grande, 1 H-Mediana, 33 H-Grande XL, 56 M-Grande, 11 M-Chica, 7 M-XL).

## Costos de los demás productos
| Producto | Costo |
|---|---|
| Kit Para Representantes (queda en 0, referencia) | $724 |
| Playera Dry-fit (suelta, todas las tallas) | $249.50 |
| Rompevientos (L/S/XL) | $416 |
| Pack De 4 Cordones | $140 |
| Pack De Manuales, Kit Señalización | *pendientes* |

## Idempotencia
- **create-user**: si el correo existe, lo conserva.
- **consolidate**: al re-correr ya no hay almacenes extra → no-op.
- **decompose-kits**: marca cada kit con un movimiento de desglose; no vuelve a desglosar.
- **import-costs**: fija `cost` de forma absoluta.

## Verificado (dry-run de solo lectura contra producción)
- Consolidación: FULL 1 (807) + FULL 2 (455) → Almacén Mercado Pago; Oficina CDMX (21, prueba) descartada.
- Desglose: 254 kits → piezas individuales (coincide con la hoja Desgloce).
- Costos: 20 productos con costo, 2 pendientes, 0 sin regla.

## Pendiente
- [ ] Costo de Pack De Manuales y Kit Señalización (la clienta los valida).
- [ ] Función "armar kit eligiendo playera" al hacer la solicitud (siguiente iteración).
