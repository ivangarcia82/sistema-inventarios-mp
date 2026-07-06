// src/app/(app)/movements/new/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProducts, getAllProducts } from "@/app/actions/products";
import { getWarehouses, getAllWarehouses } from "@/app/actions/warehouses";
import { MovementForm } from "@/components/pos/movement-form";

export default async function NewMovementPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;

  const isAdmin = userRole === "ADMIN_GI";

  // Solo admin GI puede registrar movimientos manuales (los usuarios MP quedan fuera).
  if (!isAdmin) redirect("/dashboard");

  const [productsRes, warehousesRes] = await Promise.all([
    isAdmin ? getAllProducts() : getProducts(userOrgId),
    isAdmin ? getAllWarehouses() : getWarehouses(userOrgId),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Registrar Movimiento</h1>
      <p className="text-sm text-slate-500 mb-6">Registra entradas, salidas, transferencias o retiros.</p>
      <MovementForm
        products={productsRes.success ? (productsRes.data as any) : []}
        warehouses={warehousesRes.success ? (warehousesRes.data as any) : []}
        userRole={userRole}
      />
    </div>
  );
}
