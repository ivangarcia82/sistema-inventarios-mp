// src/lib/scope-logic.ts
// Lógica pura del alcance de datos por usuario (sin acceso a base ni a sesión),
// para poder probarla aislada. El wrapper con sesión vive en `scope.ts`.
//
// La organización es el primer nivel de aislamiento. Además, un usuario puede
// tener un ALMACÉN ASIGNADO (`User.warehouseId`): cuando lo tiene, solo ve el
// inventario, los productos, las colectas y los movimientos de ese almacén,
// aunque comparta organización con otros usuarios.
// Los ADMIN_GI ignoran la restricción: siempre ven todo.

export interface Scope {
  userId: string;
  userOrgId: string;
  userRole: string;
  isAdmin: boolean;
  /** Almacén al que está restringido el usuario. null = sin restricción. */
  warehouseId: string | null;
}

/**
 * Filtro Prisma para `InventoryItem`.
 * Restringido -> solo su almacén. Sin restringir -> toda la organización objetivo.
 */
export function inventoryWhere(scope: Scope, targetOrgId?: string) {
  if (scope.warehouseId) return { warehouseId: scope.warehouseId };
  return targetOrgId ? { product: { organizationId: targetOrgId } } : {};
}

/**
 * Filtro Prisma para `Product`. Un usuario restringido solo ve los productos
 * que tienen una fila de inventario en su almacén. La fila persiste aunque la
 * cantidad llegue a 0, así que un producto agotado no desaparece del catálogo.
 */
export function productWhere(scope: Scope, targetOrgId: string) {
  if (scope.warehouseId) {
    return {
      organizationId: targetOrgId,
      inventoryItems: { some: { warehouseId: scope.warehouseId } },
    };
  }
  return { organizationId: targetOrgId };
}

/** ¿Puede este usuario ver/operar el almacén indicado? */
export function canAccessWarehouse(scope: Scope, warehouseId: string | null | undefined) {
  if (scope.isAdmin) return true;
  if (!scope.warehouseId) return true;
  return warehouseId === scope.warehouseId;
}
