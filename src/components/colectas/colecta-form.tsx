// src/components/colectas/colecta-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createColecta } from "@/app/actions/colectas";
import { Plus, Minus, X, Loader2 } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Warehouse = { id: string; name: string; organization?: { name: string } };
type Line = { productId: string; name: string; unit: string; qty: number };

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export function ColectaForm({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const router = useRouter();
  const [ordenCompra, setOrdenCompra] = useState("");
  const [numeroColecta, setNumeroColecta] = useState("");
  const [numeroSolicitud, setNumeroSolicitud] = useState("");
  const [metodoEntrega, setMetodoEntrega] = useState("RECOLECCION");
  const [clienteNombre, setClienteNombre] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState(products[0]?.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addLine = () => {
    const p = products.find((x) => x.id === picker);
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) return;
    setLines([...lines, { productId: p.id, name: p.name, unit: p.unit, qty: 1 }]);
  };

  const updateQty = (productId: string, delta: number) =>
    setLines(lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, l.qty + delta) } : l)));

  const removeLine = (productId: string) => setLines(lines.filter((l) => l.productId !== productId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!warehouseId) { setError("Selecciona un almacén"); return; }
    if (!lines.length) { setError("Agrega al menos un producto"); return; }
    setLoading(true);

    const res = await createColecta({
      ordenCompra: ordenCompra || undefined,
      numeroColecta: numeroColecta || undefined,
      numeroSolicitud: numeroSolicitud || undefined,
      metodoEntrega,
      clienteNombre: clienteNombre || undefined,
      warehouseId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
    });

    if (!res.success) {
      setError(res.error ?? "Error al crear");
      setLoading(false);
    } else {
      router.push(`/colectas/${res.data.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}># Orden de compra</label>
          <input value={ordenCompra} onChange={(e) => setOrdenCompra(e.target.value)} className={inputCls} placeholder="OC-7781" />
        </div>
        <div>
          <label className={labelCls}># Colecta MP/ML</label>
          <input value={numeroColecta} onChange={(e) => setNumeroColecta(e.target.value)} className={inputCls} placeholder="ML-44920" />
        </div>
        <div>
          <label className={labelCls}># Solicitud / Entrega</label>
          <input value={numeroSolicitud} onChange={(e) => setNumeroSolicitud(e.target.value)} className={inputCls} placeholder="SOL-001" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Método de entrega</label>
          <select value={metodoEntrega} onChange={(e) => setMetodoEntrega(e.target.value)} className={inputCls + " cursor-pointer"}>
            <option value="RECOLECCION">Recolección</option>
            <option value="ENVIO">Envío</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Cliente / contacto</label>
          <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={inputCls} placeholder="Nombre de la clienta" />
        </div>
        <div>
          <label className={labelCls}>Almacén *</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className={inputCls + " cursor-pointer"}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}{w.organization ? ` — ${w.organization.name}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Productos *</label>
        <div className="flex gap-2">
          <select value={picker} onChange={(e) => setPicker(e.target.value)} className={inputCls + " cursor-pointer"}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ""}</option>
            ))}
          </select>
          <button type="button" onClick={addLine} className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {lines.length > 0 && (
          <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
            {lines.map((l) => (
              <div key={l.productId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-slate-700 truncate">{l.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => updateQty(l.productId, -1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer">
                    <Minus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 w-6 text-center tabular-nums">{l.qty}</span>
                  <button type="button" onClick={() => updateQty(l.productId, 1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 cursor-pointer">
                    <Plus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-400 w-8">{l.unit}</span>
                  <button type="button" onClick={() => removeLine(l.productId)} className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>}

      <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Creando..." : "Crear colecta"}
      </button>
    </form>
  );
}
