// src/app/(app)/admin/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllProducts, createProduct, deleteProduct, updateProduct } from "@/app/actions/products";
import { getOrganizations } from "@/app/actions/warehouses";
import { Trash2, Plus, Inbox } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; unit: string; description: string | null; price: number | null; cost: number | null; piecesPerUnit: number; organization: { name: string } };
type Org = { id: string; name: string };

const currency = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

// Celda de dinero editable en línea (guarda al perder foco / Enter si cambió).
function MoneyCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [value, editing]);

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next != null && (Number.isNaN(next) || next < 0)) {
      setDraft(value == null ? "" : String(value)); // revertir inválido
      return;
    }
    if (next === value) return; // sin cambios
    setSaving(true);
    await onSave(next);
    setSaving(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setEditing(false); }
        }}
        className="w-24 px-2 py-1 border border-primary/60 rounded-md text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary bg-white"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Clic para editar"
      className={`px-1.5 py-0.5 rounded-md hover:bg-slate-100 tabular-nums transition-colors cursor-pointer ${saving ? "opacity-50" : ""} ${value != null ? "text-slate-700 font-medium" : "text-slate-300"}`}
    >
      {value != null ? currency(value) : "—"}
    </button>
  );
}

// Celda de entero editable en línea (para "piezas por unidad").
function IntCell({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  const commit = async () => {
    setEditing(false);
    const next = Math.trunc(Number(draft.trim()));
    if (!Number.isFinite(next) || next < 1) { setDraft(String(value)); return; }
    if (next === value) return;
    await onSave(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="1"
        step="1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className="w-14 px-2 py-1 border border-primary/60 rounded-md text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary bg-white"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      title="Piezas por unidad — clic para editar"
      className={`px-1.5 py-0.5 rounded-md hover:bg-slate-100 tabular-nums transition-colors cursor-pointer ${value > 1 ? "text-slate-700 font-medium" : "text-slate-300"}`}
    >
      {value}
    </button>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", unit: "pza", description: "", price: "", cost: "", piecesPerUnit: "1", organizationId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [pRes, oRes] = await Promise.all([getAllProducts(), getOrganizations()]);
    if (pRes.success) setProducts(pRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  useEffect(() => { load(); }, []);

  const parseMoney = (s: string): number | null | "invalid" => {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isNaN(n) || n < 0 ? "invalid" : n;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceNum = parseMoney(form.price);
    const costNum = parseMoney(form.cost);
    if (priceNum === "invalid") { setError("El precio debe ser un número válido (≥ 0)"); return; }
    if (costNum === "invalid") { setError("El costo debe ser un número válido (≥ 0)"); return; }
    setLoading(true);
    const ppu = Math.max(1, Math.trunc(Number(form.piecesPerUnit) || 1));
    const res = await createProduct({
      name: form.name,
      sku: form.sku || undefined,
      unit: form.unit,
      description: form.description || undefined,
      price: priceNum,
      cost: costNum,
      piecesPerUnit: ppu,
      organizationId: form.organizationId,
    });
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, name: "", sku: "", description: "", price: "", cost: "", piecesPerUnit: "1" })); await load(); }
    setLoading(false);
  };

  const handleUpdateField = async (
    id: string,
    field: "cost" | "price" | "piecesPerUnit",
    value: number | null
  ) => {
    // Optimista: actualiza local y persiste.
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    const res = await updateProduct(id, { [field]: value ?? undefined } as any);
    if (!res.success) { alert(res.error); await load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const res = await deleteProduct(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Productos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Catálogo de productos promocionales</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo producto</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={inputCls}
              placeholder="Ej. Taza personalizada"
            />
          </div>
          <div>
            <label className={labelCls}>SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className={inputCls}
              placeholder="Ej. TAZA-001"
            />
          </div>
          <div>
            <label className={labelCls}>Unidad</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={inputCls + " cursor-pointer"}
            >
              {["pza", "caja", "kit", "par", "rollo"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Pzas por unidad</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.piecesPerUnit}
              onChange={(e) => setForm({ ...form, piecesPerUnit: e.target.value })}
              className={inputCls}
              placeholder="Ej. 5 (un kit = 5 pzas)"
            />
          </div>
          <div>
            <label className={labelCls}>Costo (MXN)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className={inputCls}
              placeholder="Ej. 80.00"
            />
          </div>
          <div>
            <label className={labelCls}>Precio (MXN)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputCls}
              placeholder="Ej. 125.50"
            />
          </div>
          <div>
            <label className={labelCls}>Organización</label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className={inputCls + " cursor-pointer"}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
              placeholder="Descripción opcional"
            />
          </div>
          <div className="col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar producto
            </button>
          </div>
        </form>
        {error && (
          <p className="text-red-600 text-sm mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pzas/u</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Costo</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organización</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {p.sku ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                    {p.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <IntCell value={p.piecesPerUnit} onSave={(v) => handleUpdateField(p.id, "piecesPerUnit", v)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <MoneyCell value={p.cost} onSave={(v) => handleUpdateField(p.id, "cost", v)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <MoneyCell value={p.price} onSave={(v) => handleUpdateField(p.id, "price", v)} />
                </td>
                <td className="px-4 py-3 text-slate-500">{p.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin productos registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
