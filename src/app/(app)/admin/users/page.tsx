// src/app/(app)/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getUsers, createUser, deleteUser, setUserWarehouse } from "@/app/actions/users";
import { getOrganizations, getAllWarehouses } from "@/app/actions/warehouses";
import { Trash2, Plus, Inbox } from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organization: { name: string };
  warehouseId: string | null;
  warehouse: { id: string; name: string } | null;
  createdAt: Date;
};
type Org = { id: string; name: string };
type Wh = { id: string; name: string; organizationId: string };

const roleLabel: Record<string, string> = { ADMIN_GI: "Admin GI", USER_MP: "Usuario Mercado Pago" };
const roleBadge: Record<string, string> = {
  ADMIN_GI: "bg-primary/10 text-primary",
  USER_MP: "bg-emerald-100 text-emerald-700",
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "USER_MP" as "ADMIN_GI" | "USER_MP",
    organizationId: "",
    warehouseId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [uRes, oRes, wRes] = await Promise.all([getUsers(), getOrganizations(), getAllWarehouses()]);
    if (uRes.success) setUsers(uRes.data as any);
    if (wRes.success) setWarehouses(wRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  // Solo se pueden asignar almacenes de la organización elegida.
  const formWarehouses = warehouses.filter((w) => w.organizationId === form.organizationId);

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createUser({ ...form, warehouseId: form.warehouseId || null });
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, email: "", password: "", name: "" })); await load(); }
    setLoading(false);
  };

  const handleWarehouseChange = async (userId: string, warehouseId: string) => {
    const res = await setUserWarehouse(userId, warehouseId || null);
    if (!res.success) alert(res.error);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await deleteUser(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Administra el acceso al sistema</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo usuario</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={inputCls}
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="off"
              className={inputCls}
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className={labelCls}>Contraseña *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as "ADMIN_GI" | "USER_MP";
                setForm({ ...form, role, warehouseId: role === "ADMIN_GI" ? "" : form.warehouseId });
              }}
              className={inputCls + " cursor-pointer"}
            >
              <option value="USER_MP">Usuario Mercado Pago</option>
              <option value="ADMIN_GI">Admin GI</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Organización</label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value, warehouseId: "" })}
              className={inputCls + " cursor-pointer"}
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Almacén asignado</label>
            <select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              disabled={form.role === "ADMIN_GI"}
              className={inputCls + " cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"}
            >
              <option value="">Toda la organización</option>
              {formWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {form.role === "ADMIN_GI"
                ? "Los Admin GI siempre ven todo."
                : "Si eliges un almacén, el usuario solo verá el inventario de ese almacén."}
            </p>
          </div>
          <div className="col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear usuario
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organización</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Almacén asignado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleBadge[u.role] ?? "bg-slate-100 text-slate-700"}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.organization.name}</td>
                <td className="px-4 py-3">
                  {u.role === "ADMIN_GI" ? (
                    <span className="text-xs text-slate-400">Ve todo</span>
                  ) : (
                    <select
                      value={u.warehouseId ?? ""}
                      onChange={(e) => handleWarehouseChange(u.id, e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded-md text-xs bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary max-w-[190px]"
                    >
                      <option value="">Toda la organización</option>
                      {warehouses
                        .filter((w) => w.organizationId === u.organizationId)
                        .map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin usuarios registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
