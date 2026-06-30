// src/app/(app)/colectas/page.tsx
import { getColectas } from "@/app/actions/colectas";
import { ColectasView } from "./colectas-view";

export default async function ColectasPage() {
  const res = await getColectas(["COLECTA", "ENVIO"]);
  const colectas = res.success ? res.data : [];

  return (
    <ColectasView
      title="Colectas"
      subtitle="Lo que Mercado Pago recolecta del almacén Álamos"
      colectas={colectas}
      newHref="/colectas/new?tipo=COLECTA"
      newLabel="Nueva colecta"
    />
  );
}
