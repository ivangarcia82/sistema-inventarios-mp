// src/app/(app)/colectas/new/page.tsx
import { auth } from "@/lib/auth";
import { getProducts, getAllProducts } from "@/app/actions/products";
import { getWarehouses, getAllWarehouses } from "@/app/actions/warehouses";
import { ColectaForm } from "@/components/colectas/colecta-form";

export default async function NewColectaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;
  const isAdmin = userRole === "ADMIN_GI";

  const [productsRes, warehousesRes] = await Promise.all([
    isAdmin ? getAllProducts() : getProducts(userOrgId),
    isAdmin ? getAllWarehouses() : getWarehouses(userOrgId),
  ]);

  const esRetiro = tipo === "RETIRO_FULL";
  const products = productsRes.success ? (productsRes.data as any[]) : [];
  // Playeras de kit (creadas por el desglose): "Playera <talla>" sin "Dry-fit".
  const kitPlayeras = products.filter(
    (p: any) => /^playera /i.test(p.name) && !/dry-fit/i.test(p.name)
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">{esRetiro ? "Nuevo retiro Full" : "Nueva colecta"}</h1>
      <p className="text-sm text-slate-500 mb-6">Captura los datos y los productos a preparar.</p>
      <ColectaForm
        products={products}
        warehouses={warehousesRes.success ? (warehousesRes.data as any) : []}
        kitPlayeras={kitPlayeras}
        defaultTipo={tipo}
      />
    </div>
  );
}
