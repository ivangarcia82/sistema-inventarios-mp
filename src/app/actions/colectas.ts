// src/app/actions/colectas.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nextFolio } from "@/lib/colectas-logic";

export interface CreateColectaInput {
  ordenCompra?: string;
  numeroColecta?: string;
  numeroSolicitud?: string;
  metodoEntrega: string; // "RECOLECCION" | "ENVIO"
  clienteNombre?: string;
  warehouseId: string;
  items: { productId: string; quantity: number }[];
}

async function getSessionCtx() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: (session.user as any).id as string,
    userOrgId: (session.user as any).organizationId as string,
    userRole: (session.user as any).role as string,
  };
}

export async function createColecta(input: CreateColectaInput) {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  if (!input.warehouseId) return { success: false as const, error: "Selecciona un almacén" };
  if (!input.items.length) return { success: false as const, error: "Agrega al menos un producto" };
  if (input.items.some((i) => i.quantity <= 0)) {
    return { success: false as const, error: "Las cantidades deben ser mayores a 0" };
  }

  // El almacén define la organización de la colecta.
  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) return { success: false as const, error: "Almacén no encontrado" };
  if (ctx.userRole !== "ADMIN_GI" && warehouse.organizationId !== ctx.userOrgId) {
    return { success: false as const, error: "No autorizado para este almacén" };
  }
  const organizationId = warehouse.organizationId;

  try {
    const colecta = await prisma.$transaction(async (tx) => {
      const count = await tx.colecta.count({ where: { organizationId } });
      return tx.colecta.create({
        data: {
          folio: nextFolio(count),
          ordenCompra: input.ordenCompra?.trim() || null,
          numeroColecta: input.numeroColecta?.trim() || null,
          numeroSolicitud: input.numeroSolicitud?.trim() || null,
          metodoEntrega: input.metodoEntrega === "ENVIO" ? "ENVIO" : "RECOLECCION",
          clienteNombre: input.clienteNombre?.trim() || null,
          status: "CREADA",
          organizationId,
          warehouseId: input.warehouseId,
          createdById: ctx.userId,
          items: {
            create: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          },
        },
      });
    });

    revalidatePath("/colectas");
    return { success: true as const, data: { id: colecta.id } };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Folio duplicado, intenta de nuevo" };
    return { success: false as const, error: e.message ?? "Error al crear la colecta" };
  }
}

export async function getColectas() {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const where = ctx.userRole === "ADMIN_GI" ? {} : { organizationId: ctx.userOrgId };

  const colectas = await prisma.colecta.findMany({
    where,
    include: {
      warehouse: { select: { name: true } },
      organization: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { success: true as const, data: colectas };
}

export async function getColecta(id: string) {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const colecta = await prisma.colecta.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true } },
      organization: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true, price: true } } },
      },
      avisos: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!colecta) return { success: false as const, error: "Colecta no encontrada" };
  if (ctx.userRole !== "ADMIN_GI" && colecta.organizationId !== ctx.userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  // Serializar Decimal (price) a número.
  const serialized = {
    ...colecta,
    items: colecta.items.map((it) => ({
      ...it,
      product: { ...it.product, price: it.product.price != null ? Number(it.product.price) : null },
    })),
  };

  return { success: true as const, data: serialized };
}

export async function getOrdenesColectas() {
  const ctx = await getSessionCtx();
  if (!ctx) return { success: false as const, error: "No autorizado" };

  const where = ctx.userRole === "ADMIN_GI" ? {} : { organizationId: ctx.userOrgId };

  const rows = await prisma.colecta.findMany({
    where,
    select: { id: true, folio: true, ordenCompra: true, numeroColecta: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return { success: true as const, data: rows };
}
