import Link from "next/link";
import { getOrdenesColectas } from "@/app/actions/colectas";
import { ArrowLeft, Inbox } from "lucide-react";

export default async function OrdenesColectasPage() {
  const res = await getOrdenesColectas();
  const rows = res.success ? res.data : [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/colectas" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Órdenes ↔ Colectas</h1>
          <p className="text-sm text-slate-500 mt-0.5"># Orden de compra y su # de colecta asignado por MP/ML</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">N.° Orden de compra</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">N.° Colecta MP/ML</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/colectas/${r.id}`} className="text-slate-800 hover:text-primary hover:underline">
                    {r.ordenCompra ?? <span className="text-slate-300">—</span>}
                  </Link>
                  <p className="text-xs text-slate-400">{r.folio}</p>
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {r.numeroColecta ?? <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin colectas</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
