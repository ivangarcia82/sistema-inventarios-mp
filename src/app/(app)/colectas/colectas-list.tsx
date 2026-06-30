// src/app/(app)/colectas/colectas-list.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Inbox } from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE, METODO_LABELS, type ColectaStatus } from "@/lib/colectas-logic";
import { Countdown } from "@/components/colectas/countdown";

type Row = {
  id: string;
  folio: string;
  ordenCompra: string | null;
  numeroColecta: string | null;
  numeroSolicitud: string | null;
  metodoEntrega: string;
  status: string;
  prepDeadlineAt: string | Date | null;
  createdAt: string | Date;
  warehouse: { name: string } | null;
  organization: { name: string };
  _count: { items: number };
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "CREADA", label: "Creadas" },
  { value: "EN_PREPARACION", label: "En preparación" },
  { value: "LISTA", label: "Listas" },
  { value: "RECOLECTADA", label: "Recolectadas" },
];

export function ColectasList({ colectas }: { colectas: Row[] }) {
  const [filter, setFilter] = useState("");
  const rows = filter ? colectas.filter((c) => c.status === filter) : colectas;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === f.value
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Folio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">OC / # Colecta</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const status = c.status as ColectaStatus;
              return (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/colectas/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.folio}
                    </Link>
                    <p className="text-xs text-slate-400">{c._count.items} prod.</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>OC: {c.ordenCompra ?? "—"}</p>
                    <p className="text-slate-400">Col: {c.numeroColecta ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{METODO_LABELS[c.metodoEntrega] ?? c.metodoEntrega}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "EN_PREPARACION" && c.prepDeadlineAt ? (
                      <Countdown deadlineISO={new Date(c.prepDeadlineAt).toISOString()} />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(c.createdAt), "dd MMM yyyy", { locale: es })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
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
