// src/app/actions/users.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
  return session!;
}

export async function getUsers() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      organizationId: true,
      organization: { select: { name: true } },
      warehouseId: true,
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { success: true as const, data: users };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN_GI" | "USER_MP";
  organizationId: string;
  /** Almacén asignado. Si se define, el usuario solo verá ese almacén. */
  warehouseId?: string | null;
}) {
  await requireAdmin();
  try {
    const hashed = await bcrypt.hash(data.password, 10);
    // Los ADMIN_GI ven todo: la asignación de almacén no aplica.
    const warehouseId = data.role === "ADMIN_GI" ? null : (data.warehouseId || null);
    const user = await prisma.user.create({
      data: { ...data, warehouseId, password: hashed },
    });
    revalidatePath("/admin/users");
    return { success: true as const, data: { id: user.id, email: user.email } };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "El correo ya está registrado" };
    return { success: false as const, error: "Error al crear usuario" };
  }
}

/**
 * Asigna (o quita) el almacén de un usuario existente.
 * Con almacén asignado, el usuario solo ve el inventario, los productos, las
 * colectas y los movimientos de ese almacén. `null` = ve toda su organización.
 */
export async function setUserWarehouse(id: string, warehouseId: string | null) {
  await requireAdmin();
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { organizationId: true, role: true } });
    if (!user) return { success: false as const, error: "Usuario no encontrado" };

    if (warehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { organizationId: true } });
      if (!wh) return { success: false as const, error: "Almacén no encontrado" };
      if (wh.organizationId !== user.organizationId) {
        return { success: false as const, error: "El almacén es de otra organización" };
      }
    }

    await prisma.user.update({ where: { id }, data: { warehouseId } });
    revalidatePath("/admin/users");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Error al asignar el almacén" };
  }
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if ((session.user as any).id === id) return { success: false as const, error: "No puedes eliminar tu propia cuenta" };
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Error al eliminar usuario" };
  }
}
