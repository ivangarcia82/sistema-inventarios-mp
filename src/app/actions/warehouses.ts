// src/app/actions/warehouses.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
  return session!;
}

export async function getWarehouses(organizationId?: string) {
  const scope = await getScope();
  if (!scope) return { success: false as const, error: "No autorizado" };

  const orgId = organizationId ?? scope.userOrgId;

  // USER_MP solo puede ver su propia org
  if (!scope.isAdmin && orgId !== scope.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const warehouses = await prisma.warehouse.findMany({
    // Con almacén asignado, el usuario solo ve ese almacén.
    where: scope.warehouseId
      ? { id: scope.warehouseId }
      : { organizationId: orgId },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { success: true as const, data: warehouses };
}

export async function getAllWarehouses() {
  await requireAdmin();
  const warehouses = await prisma.warehouse.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  });
  return { success: true as const, data: warehouses };
}

export async function getOrganizations() {
  await requireAdmin();
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  return { success: true as const, data: orgs };
}

export async function createWarehouse(data: { name: string; organizationId: string }) {
  await requireAdmin();
  try {
    const warehouse = await prisma.warehouse.create({ data });
    revalidatePath("/admin/warehouses");
    revalidatePath("/inventory");
    return { success: true as const, data: warehouse };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Ya existe un almacén con ese nombre en la organización" };
    return { success: false as const, error: "Error al crear almacén" };
  }
}

export async function deleteWarehouse(id: string) {
  await requireAdmin();
  try {
    await prisma.warehouse.delete({ where: { id } });
    revalidatePath("/admin/warehouses");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "No se puede eliminar: tiene movimientos o inventario asociado" };
  }
}
