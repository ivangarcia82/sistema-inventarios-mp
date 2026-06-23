// src/components/colectas/colecta-detail.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { transitionColecta } from "@/app/actions/colectas";
import { STATUS_LABELS, STATUS_BADGE, METODO_LABELS, type ColectaStatus, type ColectaAction } from "@/lib/colectas-logic";
import { Countdown } from "@/components/colectas/countdown";
import { Loader2, Copy, Check, PackageCheck, Bell } from "lucide-react";

type Item = { id: string; quantity: number; product: { name: string; sku: string | null; unit: string } };
type Aviso = { id: string; tipo: string; mensaje: string; createdAt: string | Date; createdBy: { name: string } };
type Colecta = {
  id: string;
  folio: string;
  ordenCompra: string | null;
  numeroColecta: string | null;
  numeroSolicitud: string | null;
  metodoEntrega: string;
  status: string;
  clienteNombre: string | null;
  prepDeadlineAt: string | Date | null;
  warehouse: { name: string } | null;
  organization: { name: string };
  createdBy: { name: string };
  createdAt: string | Date;
  items: Item[];
  avisos: Aviso[];
};

const ACTION_LABEL: Record<ColectaAction, string> = {
  LLEGO_TALLER: "Marcar llegada de taller",
  MARCAR_LISTA: "Marcar lista para recolección",
  MARCAR_RECOLECTADA: "Marcar recolectada",
  CANCELAR: "Cancelar colecta",
};

const NEXT_ACTION: Record<string, ColectaAction | null> = {
  CREADA: "LLEGO_TALLER",
  EN_PREPARACION: "MARCAR_LISTA",
  LISTA: "MARCAR_RECOLECTADA",
  RECOLECTADA: null,
  CANCELADA: null,
};

export function ColectaDetail({ colecta }: { colecta: Colecta }) {
  const router = useRouter();
  const [loading, setLoading] = useState<ColectaAction | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const status = colecta.status as ColectaStatus;
  const nextAction = NEXT_ACTION[colecta.status] ?? null;
  const canCancel = ["CREADA", "EN_PREPARACION", "LISTA"].includes(colecta.status);

  const run = async (action: ColectaAction) => {
    setError("");
    setLoading(action);
    const res = await transitionColecta(colecta.id, action);
    if (!res.success) setError(res.error ?? "Error");
    else router.refresh();
    setLoading(null);
  };

  const copy = async (aviso: Aviso) => {
    await navigator.clipboard.writeText(aviso.mensaje);
    setCopied(aviso.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{colecta.folio}</h1>
            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABELS[status] ?? colecta.status}
            </span>
            {colecta.status === "EN_PREPARACION" && colecta.prepDeadlineAt && (
              <Countdown deadlineISO={new Date(colecta.prepDeadlineAt).toISOString()} />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Creada {format(new Date(colecta.createdAt), "dd MMM yyyy · HH:mm", { locale: es })} por {colecta.createdBy.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {nextAction && (
            <button
              onClick={() => run(nextAction)}
              disabled={loading !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading === nextAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              {ACTION_LABEL[nextAction]}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => run("CANCELAR")}
              disabled={loading !== null}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading === "CANCELAR" ? "Cancelando..." : "Cancelar colecta"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>}

      {/* Datos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="# Orden de compra" value={colecta.ordenCompra ?? "—"} />
        <Field label="# Colecta MP/ML" value={colecta.numeroColecta ?? "—"} />
        <Field label="# Solicitud / Entrega" value={colecta.numeroSolicitud ?? "—"} />
        <Field label="Método de entrega" value={METODO_LABELS[colecta.metodoEntrega] ?? colecta.metodoEntrega} />
        <Field label="Cliente / contacto" value={colecta.clienteNombre ?? "—"} />
        <Field label="Almacén" value={colecta.warehouse?.name ?? "—"} />
      </div>

      {/* Productos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Productos a preparar</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {colecta.items.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-2.5">
                  <p className="text-slate-800">{it.product.name}</p>
                  {it.product.sku && <p className="text-xs text-slate-400 font-mono">{it.product.sku}</p>}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                  {it.quantity} <span className="font-normal text-slate-400">{it.product.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Avisos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Avisos a la clienta</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">El envío automático aún no está conectado: copia el texto y envíalo por tu canal habitual.</p>
        {colecta.avisos.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no se han generado avisos.</p>
        ) : (
          <div className="space-y-2.5">
            {colecta.avisos.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-500">
                    {a.tipo === "LLEGO_TALLER" ? "Llegó de taller" : "Lista para recolección"} ·{" "}
                    {format(new Date(a.createdAt), "dd MMM · HH:mm", { locale: es })}
                  </span>
                  <button onClick={() => copy(a)} className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                    {copied === a.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === a.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="text-sm text-slate-700">{a.mensaje}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
