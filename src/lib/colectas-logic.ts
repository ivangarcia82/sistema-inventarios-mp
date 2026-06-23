// src/lib/colectas-logic.ts
// Lógica pura de Colectas: estados, transiciones, cronómetro 48h y avisos.
// Sin dependencias de Prisma/React para poder probarse con vitest.

export const COLECTA_STATUS = {
  CREADA: "CREADA",
  EN_PREPARACION: "EN_PREPARACION",
  LISTA: "LISTA",
  RECOLECTADA: "RECOLECTADA",
  CANCELADA: "CANCELADA",
} as const;

export type ColectaStatus = keyof typeof COLECTA_STATUS;

export const METODO_ENTREGA = {
  RECOLECCION: "RECOLECCION",
  ENVIO: "ENVIO",
} as const;

export type ColectaAction = "LLEGO_TALLER" | "MARCAR_LISTA" | "MARCAR_RECOLECTADA" | "CANCELAR";
export type AvisoTipo = "LLEGO_TALLER" | "LISTA";

export const PREP_WINDOW_HOURS = 48;

export const STATUS_LABELS: Record<ColectaStatus, string> = {
  CREADA: "Creada",
  EN_PREPARACION: "En preparación",
  LISTA: "Lista",
  RECOLECTADA: "Recolectada",
  CANCELADA: "Cancelada",
};

export const STATUS_BADGE: Record<ColectaStatus, string> = {
  CREADA: "bg-slate-100 text-slate-600",
  EN_PREPARACION: "bg-primary/10 text-primary",
  LISTA: "bg-emerald-100 text-emerald-700",
  RECOLECTADA: "bg-violet-100 text-violet-700",
  CANCELADA: "bg-red-100 text-red-600",
};

export const METODO_LABELS: Record<string, string> = {
  RECOLECCION: "Recolección",
  ENVIO: "Envío",
};

export function nextFolio(count: number): string {
  return `COL-${String(count + 1).padStart(4, "0")}`;
}

export function computeDeadline(arrivedAt: Date): Date {
  return new Date(arrivedAt.getTime() + PREP_WINDOW_HOURS * 60 * 60 * 1000);
}

const TRANSITIONS: Record<ColectaAction, { from: ColectaStatus[]; next: ColectaStatus }> = {
  LLEGO_TALLER: { from: ["CREADA"], next: "EN_PREPARACION" },
  MARCAR_LISTA: { from: ["EN_PREPARACION"], next: "LISTA" },
  MARCAR_RECOLECTADA: { from: ["LISTA"], next: "RECOLECTADA" },
  CANCELAR: { from: ["CREADA", "EN_PREPARACION", "LISTA"], next: "CANCELADA" },
};

export function validateTransition(
  current: string,
  action: ColectaAction
): { ok: true; next: ColectaStatus } | { ok: false; error: string } {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, error: "Acción desconocida" };
  if (!t.from.includes(current as ColectaStatus)) {
    return { ok: false, error: `No se puede aplicar "${action}" desde el estado ${current}` };
  }
  return { ok: true, next: t.next };
}

export function getCountdownState(
  deadlineISO: string,
  nowMs: number
): { msRemaining: number; expired: boolean; level: "green" | "amber" | "red"; label: string } {
  const deadlineMs = new Date(deadlineISO).getTime();
  const msRemaining = deadlineMs - nowMs;
  const expired = msRemaining <= 0;

  const absMin = Math.floor(Math.abs(msRemaining) / 60000);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const hm = `${h}h ${m}m`;

  if (expired) return { msRemaining, expired, level: "red", label: `Vencida hace ${hm}` };
  const level = msRemaining <= 24 * 60 * 60 * 1000 ? "amber" : "green";
  return { msRemaining, expired, level, label: `Faltan ${hm}` };
}

export function buildAvisoMessage(
  tipo: AvisoTipo,
  ctx: { clienteNombre?: string | null; numeroColecta?: string | null; folio: string }
): string {
  const saludo = ctx.clienteNombre ? `Hola, ${ctx.clienteNombre}.` : "Hola.";
  const ref = ctx.numeroColecta && ctx.numeroColecta.trim() ? ctx.numeroColecta : ctx.folio;
  if (tipo === "LLEGO_TALLER") {
    return `${saludo} Le informamos que el material de la colecta ${ref} ya llegó de taller al almacén y está listo para preparar su empaque.`;
  }
  return `${saludo} Le informamos que el material de la colecta ${ref} ya está listo y preparado en almacén para su recolección.`;
}
