import { describe, it, expect } from "vitest";
import {
  PREP_WINDOW_HOURS,
  nextFolio,
  computeDeadline,
  validateTransition,
  getCountdownState,
  buildAvisoMessage,
  STATUS_LABELS,
  METODO_LABELS,
} from "./colectas-logic";

describe("nextFolio", () => {
  it("formatea consecutivo a 4 dígitos con prefijo COL-", () => {
    expect(nextFolio(0)).toBe("COL-0001");
    expect(nextFolio(41)).toBe("COL-0042");
    expect(nextFolio(9999)).toBe("COL-10000");
  });
});

describe("computeDeadline", () => {
  it("suma 48 horas exactas", () => {
    const arrived = new Date("2026-06-23T10:00:00.000Z");
    expect(computeDeadline(arrived).toISOString()).toBe("2026-06-25T10:00:00.000Z");
  });
  it("PREP_WINDOW_HOURS es 48", () => {
    expect(PREP_WINDOW_HOURS).toBe(48);
  });
});

describe("validateTransition", () => {
  it("CREADA + LLEGO_TALLER -> EN_PREPARACION", () => {
    expect(validateTransition("CREADA", "LLEGO_TALLER")).toEqual({ ok: true, next: "EN_PREPARACION" });
  });
  it("EN_PREPARACION + MARCAR_LISTA -> LISTA", () => {
    expect(validateTransition("EN_PREPARACION", "MARCAR_LISTA")).toEqual({ ok: true, next: "LISTA" });
  });
  it("LISTA + MARCAR_RECOLECTADA -> RECOLECTADA", () => {
    expect(validateTransition("LISTA", "MARCAR_RECOLECTADA")).toEqual({ ok: true, next: "RECOLECTADA" });
  });
  it("permite CANCELAR desde estados no terminales", () => {
    expect(validateTransition("CREADA", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
    expect(validateTransition("EN_PREPARACION", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
    expect(validateTransition("LISTA", "CANCELAR")).toEqual({ ok: true, next: "CANCELADA" });
  });
  it("rechaza transición inválida", () => {
    const r = validateTransition("CREADA", "MARCAR_RECOLECTADA");
    expect(r.ok).toBe(false);
  });
  it("rechaza cancelar una colecta ya recolectada", () => {
    expect(validateTransition("RECOLECTADA", "CANCELAR").ok).toBe(false);
  });
  it("rechaza cancelar una colecta ya cancelada", () => {
    expect(validateTransition("CANCELADA", "CANCELAR").ok).toBe(false);
  });
});

describe("getCountdownState", () => {
  const deadline = "2026-06-25T10:00:00.000Z";
  it("verde cuando faltan más de 24h", () => {
    const now = new Date("2026-06-23T10:00:00.000Z").getTime();
    const s = getCountdownState(deadline, now);
    expect(s.expired).toBe(false);
    expect(s.level).toBe("green");
  });
  it("ámbar cuando faltan 24h o menos", () => {
    const now = new Date("2026-06-24T12:00:00.000Z").getTime();
    expect(getCountdownState(deadline, now).level).toBe("amber");
  });
  it("ámbar exacto en el límite de 24h", () => {
    const now = new Date("2026-06-24T10:00:00.000Z").getTime();
    expect(getCountdownState(deadline, now).level).toBe("amber");
  });
  it("rojo y expired cuando ya pasó", () => {
    const now = new Date("2026-06-26T10:00:00.000Z").getTime();
    const s = getCountdownState(deadline, now);
    expect(s.expired).toBe(true);
    expect(s.level).toBe("red");
  });
});

describe("buildAvisoMessage", () => {
  it("LLEGO_TALLER usa numeroColecta y nombre del cliente", () => {
    const msg = buildAvisoMessage("LLEGO_TALLER", { clienteNombre: "Karla", numeroColecta: "ML-44920", folio: "COL-0001" });
    expect(msg).toContain("Karla");
    expect(msg).toContain("ML-44920");
    expect(msg).toContain("llegó de taller");
  });
  it("LISTA cae al folio cuando no hay numeroColecta", () => {
    const msg = buildAvisoMessage("LISTA", { clienteNombre: null, numeroColecta: null, folio: "COL-0007" });
    expect(msg).toContain("COL-0007");
    expect(msg).toContain("listo");
    expect(msg).not.toContain("undefined");
  });
});

describe("etiquetas", () => {
  it("STATUS_LABELS y METODO_LABELS están completas", () => {
    expect(STATUS_LABELS.EN_PREPARACION).toBe("En preparación");
    expect(METODO_LABELS.RECOLECCION).toBe("Recolección");
    expect(METODO_LABELS.ENVIO).toBe("Envío");
  });
});
