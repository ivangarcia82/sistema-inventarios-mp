// src/app/(app)/colectas/retiros-full/page.tsx
import { getColectas } from "@/app/actions/colectas";
import { ColectasView } from "../colectas-view";

export default async function RetirosFullPage() {
  const res = await getColectas(["RETIRO_FULL"]);
  const colectas = res.success ? res.data : [];

  return (
    <ColectasView
      title="Retiros Full"
      colectas={colectas}
      newHref="/colectas/new?tipo=RETIRO_FULL"
      newLabel="Nuevo retiro"
    />
  );
}
