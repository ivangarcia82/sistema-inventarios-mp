// src/app/actions/inventory.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function getInventory(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const userOrgId = (session.user as any).organizationId;
  const targetOrgId = organizationId ?? userOrgId;

  if (userRole !== "ADMIN_GI" && targetOrgId !== userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const items = await prisma.inventoryItem.findMany({
    where: { product: { organizationId: targetOrgId } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
  });

  return { success: true as const, data: items };
}

export async function getInventorySummary(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const userOrgId = (session.user as any).organizationId;

  // ADMIN_GI sin orgId explícito → visión global de todas las orgs
  const isGlobalAdmin = userRole === "ADMIN_GI" && !organizationId;
  const targetOrgId = isGlobalAdmin ? undefined : (organizationId ?? userOrgId);

  if (!isGlobalAdmin && userRole !== "ADMIN_GI" && targetOrgId !== userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const orgFilter = targetOrgId ? { organizationId: targetOrgId } : {};
  const productOrgFilter = targetOrgId ? { product: { organizationId: targetOrgId } } : {};

  const [totalProducts, totalStock, lowStockCount] = await Promise.all([
    prisma.product.count({ where: orgFilter }),
    prisma.inventoryItem.aggregate({
      where: productOrgFilter,
      _sum: { quantity: true },
    }),
    prisma.inventoryItem.count({
      where: { ...productOrgFilter, quantity: { lte: 5 } },
    }),
  ]);

  return {
    success: true as const,
    data: {
      totalProducts,
      totalStock: totalStock._sum.quantity ?? 0,
      lowStockCount,
    },
  };
}

export async function getWarehouseInventory(warehouseId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const items = await prisma.inventoryItem.findMany({
    where: { warehouseId, quantity: { gt: 0 } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
    orderBy: { product: { name: "asc" } },
  });

  return { success: true as const, data: items };
}
