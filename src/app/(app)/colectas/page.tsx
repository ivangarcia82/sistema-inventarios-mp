// src/app/(app)/colectas/page.tsx
import Link from "next/link";
import { getColectas } from "@/app/actions/colectas";
import { ColectasList } from "./colectas-list";
import { Plus, ArrowLeftRight } from "lucide-react";

export default async function ColectasPage() {
  const res = await getColectas();
  const colectas = res.success ? res.data : [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Colectas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Recolecciones de Mercado Pago / Mercado Libre</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/colectas/ordenes"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:border-primary/40 hover:text-primary transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Órdenes ↔ Colectas
          </Link>
          <Link
            href="/colectas/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva colecta
          </Link>
        </div>
      </div>

      <ColectasList colectas={colectas as any} />
    </div>
  );
}
