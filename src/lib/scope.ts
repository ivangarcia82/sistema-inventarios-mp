// src/lib/scope.ts
// Resuelve el alcance de datos del usuario de la sesión actual.
// La lógica pura de los filtros vive en `scope-logic.ts` (con pruebas).
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Scope } from "@/lib/scope-logic";

export type { Scope } from "@/lib/scope-logic";
export { inventoryWhere, productWhere, canAccessWarehouse } from "@/lib/scope-logic";

export async function getScope(): Promise<Scope | null> {
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as any).id as string;
  const userOrgId = (session.user as any).organizationId as string;
  const userRole = (session.user as any).role as string;
  const isAdmin = userRole === "ADMIN_GI";

  // Se lee de la base (no del JWT) para que un cambio de asignación aplique
  // de inmediato, sin esperar a que el usuario vuelva a iniciar sesión.
  let warehouseId: string | null = null;
  if (!isAdmin && userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { warehouseId: true },
    });
    warehouseId = u?.warehouseId ?? null;
  }

  return { userId, userOrgId, userRole, isAdmin, warehouseId };
}
