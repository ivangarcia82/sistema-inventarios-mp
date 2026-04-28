// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Package, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050A30] via-[#10145C] to-[#050A30] relative overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 mb-5">
              <Package className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white leading-tight">
              Inventario Promocionales
            </h1>
            <p className="text-sm text-slate-400 mt-1">Mercado Pago · Generando Ideas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wide">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                placeholder="tu@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/8 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-60 cursor-pointer mt-2 shadow-lg shadow-primary/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
