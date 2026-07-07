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

- [X] Entrar como **Admin GI** → redirige a `/dashboard`
- [X] El sidebar muestra la sección **Administración** (Almacenes, Productos, Usuarios)
- [X] Cerrar sesión y entrar como **Usuario MP**
- [X] El sidebar **NO** muestra Administración
- [X] Abrir una ruta sin sesión (ej. `/inventory` en incógnito) → redirige a `/login`

---

## 2) Preparar datos (como Admin GI)

- [X] `/admin/products` → crear 1–2 productos (SKU, nombre, unidad, precio)
- [X] `/admin/warehouses` → confirmar que existen los 3 del seed
- [X] `/movements/new` → registrar una **Entrada** de stock a un almacén
- [X] `/inventory` → verificar que el stock de entrada aparece

---

## 3) Ciclo de vida de una Colecta ⭐

> Estados: CREADA → EN_PREPARACION → LISTA → RECOLECTADA (CANCELADA en cualquier punto antes de recolectar)

- [X] `/colectas/new` → crear colecta (almacén, método, cliente, productos + cantidad)
- [X] Se genera folio `COL-0001`
- [X] `/colectas` → la colecta aparece en la lista
- [X] Abrir `/colectas/[id]` (detalle)
- [X] Botón **"Llegó de taller"** → estado pasa a `EN_PREPARACION`
  - [ ] Arranca el **cronómetro de 48h** (verde)
  - [ ] Se genera un **aviso** in-system con mensaje para el cliente
- [X] Botón **"Marcar lista"** → estado pasa a `LISTA`
  - [ ] Se genera el segundo aviso
- [X] Probar el botón de **copiar aviso** al portapapeles
- [X] Botón **"Marcar recolectada"** → estado pasa a `RECOLECTADA`
  - [ ] El stock de cada item se **descontó** en `/inventory`
  - [ ] Aparece un movimiento `EXIT` por producto en `/movements` (razón `Recolección COL-0001`)
- [X] `/colectas/ordenes` → vista de 2 columnas Órdenes ↔ Colectas funciona

### Casos de borde

- [X] Intentar **recolectar** una colecta con stock insuficiente → **rechaza** y NO cambia de estado
- [X] Intentar **cancelar** una colecta ya `RECOLECTADA` → no permitido
- [X] Como **Usuario MP**, abrir por URL una colecta de GI → responde **"No autorizado"**

---

## 4) POS — Salidas

- [X] `/pos` → seleccionar almacén + productos → confirmar salida
- [X] El stock baja en `/inventory`
- [X] Aparecen los movimientos `EXIT` en `/movements`

---

## 5) Verificación cruzada final

- [X] `/inventory` → las cantidades reflejan colecta recolectada + venta POS
- [X] `/movements` → todas las salidas registradas con su razón
- [X] `/dashboard` → los KPIs reflejan los cambios

---

## Happy-path mínimo (resumen)

`login admin` → `crear producto` → `entrada de stock` → `nueva colecta` → `llegó de taller → lista → recolectada` → `verificar descuento en inventario y movimientos`
