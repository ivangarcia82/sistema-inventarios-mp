// src/app/actions/inventory.ts
"use server";

import prisma from "@/lib/prisma";
import { getScope, inventoryWhere, canAccessWarehouse } from "@/lib/scope";

export async function getInventory(organizationId?: string) {
  const scope = await getScope();
  if (!scope) return { success: false as const, error: "No autorizado" };

  const targetOrgId = organizationId ?? scope.userOrgId;

  if (!scope.isAdmin && targetOrgId !== scope.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const items = await prisma.inventoryItem.findMany({
    where: inventoryWhere(scope, targetOrgId),
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true, price: true, cost: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
  });

  const serialized = items.map((i) => ({
    ...i,
    product: {
      ...i.product,
      price: i.product.price != null ? Number(i.product.price) : null,
      cost: i.product.cost != null ? Number(i.product.cost) : null,
    },
  }));

  return { success: true as const, data: serialized };
}

export async function getInventorySummary(organizationId?: string) {
  const scope = await getScope();
  if (!scope) return { success: false as const, error: "No autorizado" };

  // ADMIN_GI sin orgId explícito → visión global de todas las orgs
  const isGlobalAdmin = scope.isAdmin && !organizationId;
  const targetOrgId = isGlobalAdmin ? undefined : (organizationId ?? scope.userOrgId);

  if (!isGlobalAdmin && !scope.isAdmin && targetOrgId !== scope.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  // Con almacén asignado, el resumen cuenta solo lo de ese almacén.
  const orgFilter: any = scope.warehouseId
    ? { organizationId: targetOrgId, inventoryItems: { some: { warehouseId: scope.warehouseId } } }
    : targetOrgId
      ? { organizationId: targetOrgId }
      : {};
  const productOrgFilter: any = scope.warehouseId
    ? { warehouseId: scope.warehouseId }
    : targetOrgId
      ? { product: { organizationId: targetOrgId } }
      : {};

  const [totalProducts, totalStock, lowStockCount, valueRows] = await Promise.all([
    prisma.product.count({ where: orgFilter }),
    prisma.inventoryItem.aggregate({
      where: productOrgFilter,
      _sum: { quantity: true },
    }),
    prisma.inventoryItem.count({
      where: { ...productOrgFilter, quantity: { lte: 5 } },
    }),
    prisma.inventoryItem.findMany({
      where: productOrgFilter,
      select: { quantity: true, product: { select: { price: true } } },
    }),
  ]);

  const totalValue = valueRows.reduce(
    (sum, r) => sum + r.quantity * (r.product.price != null ? Number(r.product.price) : 0),
    0
  );

  return {
    success: true as const,
    data: {
      totalProducts,
      totalStock: totalStock._sum.quantity ?? 0,
      lowStockCount,
      totalValue,
    },
  };
}

export async function getWarehouseInventory(warehouseId: string) {
  const scope = await getScope();
  if (!scope) return { success: false as const, error: "No autorizado" };
  if (!canAccessWarehouse(scope, warehouseId)) {
    return { success: false as const, error: "No autorizado" };
  }

  const items = await prisma.inventoryItem.findMany({
    where: { warehouseId, quantity: { gt: 0 } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true, price: true, cost: true } },
    },
    orderBy: { product: { name: "asc" } },
  });

  const serialized = items.map((i) => ({
    ...i,
    product: {
      ...i.product,
      price: i.product.price != null ? Number(i.product.price) : null,
      cost: i.product.cost != null ? Number(i.product.cost) : null,
    },
  }));

  return { success: true as const, data: serialized };
}
