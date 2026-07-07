import { describe, it, expect } from "vitest";
import { buildKitItems, groupColectaItems, kitLabelFor } from "./kits-logic";

describe("buildKitItems", () => {
  it("arma 4 piezas etiquetadas (mochila, gorra, 2·lanyard, playera) por N kits", () => {
    const items = buildKitItems({
      kitGroupId: "g1",
      quantity: 3,
      playera: { id: "pl", name: "Playera Hombre Grande" },
      mochilaId: "mo",
      gorraId: "go",
      lanyardId: "la",
    });
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.kitGroupId === "g1")).toBe(true);
    expect(items.every((i) => i.kitLabel === "Kit — Playera Hombre Grande")).toBe(true);
    const qty = Object.fromEntries(items.map((i) => [i.productId, i.quantity]));
    expect(qty).toEqual({ mo: 3, go: 3, la: 6, pl: 3 });
  });
});

describe("kitLabelFor", () => {
  it("formatea la etiqueta con el nombre de la playera", () => {
    expect(kitLabelFor("Playera Mujer XL")).toBe("Kit — Playera Mujer XL");
  });
});

describe("groupColectaItems", () => {
  const mk = (id: string, quantity: number, kitGroupId: string | null, kitLabel: string | null) => ({
    id, quantity, kitGroupId, kitLabel,
  });

  it("agrupa las piezas del kit (kitQty = N) y deja las sueltas aparte", () => {
    const rows = groupColectaItems([
      mk("1", 3, "g1", "Kit — Playera Hombre Grande"),
      mk("2", 3, "g1", "Kit — Playera Hombre Grande"),
      mk("3", 6, "g1", "Kit — Playera Hombre Grande"),
      mk("4", 3, "g1", "Kit — Playera Hombre Grande"),
      mk("5", 2, null, null),
    ]);
    const kit = rows.find((r) => r.kind === "kit");
    expect(kit).toBeTruthy();
    if (kit && kit.kind === "kit") {
      expect(kit.kitQty).toBe(3);
      expect(kit.pieces).toHaveLength(4);
      expect(kit.label).toBe("Kit — Playera Hombre Grande");
    }
    expect(rows.filter((r) => r.kind === "item")).toHaveLength(1);
  });
});
