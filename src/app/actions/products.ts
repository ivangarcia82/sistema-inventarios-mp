// src/app/actions/products.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
  return session!;
}

export async function getProducts(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const orgId = organizationId ?? (session.user as any).organizationId;

  if (userRole !== "ADMIN_GI" && orgId !== (session.user as any).organizationId) {
    return { success: false as const, error: "No autorizado" };
  }

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
    include: { organization: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return { success: true as const, data: products };
}

export async function getAllProducts() {
  await requireAdmin();
  const products = await prisma.product.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  });
  return { success: true as const, data: products };
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  unit: string;
  description?: string;
  organizationId: string;
}) {
  await requireAdmin();
  try {
    const product = await prisma.product.create({ data });
    revalidatePath("/admin/products");
    revalidatePath("/inventory");
    return { success: true as const, data: product };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Ya existe un producto con ese SKU en la organización" };
    return { success: false as const, error: "Error al crear producto" };
  }
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/products");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "No se puede eliminar: tiene movimientos o inventario asociado" };
  }
}
