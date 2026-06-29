# ✅ Checklist de pruebas — Sistema de Inventarios MP

> Flujo de prueba end-to-end. Marca cada casilla conforme avanzas.
> App: http://localhost:3000

---

## 0) Levantar el entorno

- [ ] Postgres corriendo en `postgresql://ivan@localhost:5432/mp_inventory_db` (el del `.env`, **no** el de docker en :5442)
- [ ] `npx prisma migrate deploy` — esquema aplicado sin errores
- [ ] `npm run seed` — crea orgs, almacenes y los 2 usuarios
- [ ] `npm run dev` — server arriba en http://localhost:3000

**Credenciales:**
- Admin GI → `admin@generandoideas.com` / `admin123`
- Usuario MP → `usuario@mercadopago.com` / `mercadopago123`

---

## 1) Login y roles

- [ ] Entrar como **Admin GI** → redirige a `/dashboard`
- [ ] El sidebar muestra la sección **Administración** (Almacenes, Productos, Usuarios)
- [ ] Cerrar sesión y entrar como **Usuario MP**
- [ ] El sidebar **NO** muestra Administración
- [ ] Abrir una ruta sin sesión (ej. `/inventory` en incógnito) → redirige a `/login`

---

## 2) Preparar datos (como Admin GI)

- [ ] `/admin/products` → crear 1–2 productos (SKU, nombre, unidad, precio)
- [ ] `/admin/warehouses` → confirmar que existen los 3 del seed
- [ ] `/movements/new` → registrar una **Entrada** de stock a un almacén
- [ ] `/inventory` → verificar que el stock de entrada aparece

---

## 3) Ciclo de vida de una Colecta ⭐

> Estados: CREADA → EN_PREPARACION → LISTA → RECOLECTADA (CANCELADA en cualquier punto antes de recolectar)

- [ ] `/colectas/new` → crear colecta (almacén, método, cliente, productos + cantidad)
- [ ] Se genera folio `COL-0001`
- [ ] `/colectas` → la colecta aparece en la lista
- [ ] Abrir `/colectas/[id]` (detalle)
- [ ] Botón **"Llegó de taller"** → estado pasa a `EN_PREPARACION`
  - [ ] Arranca el **cronómetro de 48h** (verde)
  - [ ] Se genera un **aviso** in-system con mensaje para el cliente
- [ ] Botón **"Marcar lista"** → estado pasa a `LISTA`
  - [ ] Se genera el segundo aviso
- [ ] Probar el botón de **copiar aviso** al portapapeles
- [ ] Botón **"Marcar recolectada"** → estado pasa a `RECOLECTADA`
  - [ ] El stock de cada item se **descontó** en `/inventory`
  - [ ] Aparece un movimiento `EXIT` por producto en `/movements` (razón `Recolección COL-0001`)
- [ ] `/colectas/ordenes` → vista de 2 columnas Órdenes ↔ Colectas funciona

### Casos de borde

- [ ] Intentar **recolectar** una colecta con stock insuficiente → **rechaza** y NO cambia de estado
- [ ] Intentar **cancelar** una colecta ya `RECOLECTADA` → no permitido
- [ ] Como **Usuario MP**, abrir por URL una colecta de GI → responde **"No autorizado"**

---

## 4) POS — Salidas

- [ ] `/pos` → seleccionar almacén + productos → confirmar salida
- [ ] El stock baja en `/inventory`
- [ ] Aparecen los movimientos `EXIT` en `/movements`

---

## 5) Verificación cruzada final

- [ ] `/inventory` → las cantidades reflejan colecta recolectada + venta POS
- [ ] `/movements` → todas las salidas registradas con su razón
- [ ] `/dashboard` → los KPIs reflejan los cambios

---

## Happy-path mínimo (resumen)

`login admin` → `crear producto` → `entrada de stock` → `nueva colecta` → `llegó de taller → lista → recolectada` → `verificar descuento en inventario y movimientos`
