// src/lib/kits-logic.ts
// Lógica pura para "armar kit" en la solicitud: un kit = 1 mochila + 1 gorra +
// 2 lanyard + 1 playera (la playera la elige el usuario). Se guarda como piezas
// etiquetadas con un kitGroupId; para mostrar, se reagrupan.

export const KIT_COMPONENT_NAMES = { mochila: "Mochila", gorra: "Gorra", lanyard: "Lanyard" } as const;
export const LANYARD_PER_KIT = 2;

export function kitLabelFor(playeraName: string): string {
  return `Kit — ${playeraName}`;
}

export interface KitItemRow {
  productId: string;
  quantity: number;
  kitGroupId: string;
  kitLabel: string;
}

// Expande N kits (con una playera elegida) en sus 4 piezas etiquetadas.
export function buildKitItems(params: {
  kitGroupId: string;
  quantity: number;
  playera: { id: string; name: string };
  mochilaId: string;
  gorraId: string;
  lanyardId: string;
}): KitItemRow[] {
  const { kitGroupId, quantity: n, playera, mochilaId, gorraId, lanyardId } = params;
  const kitLabel = kitLabelFor(playera.name);
  return [
    { productId: mochilaId, quantity: n, kitGroupId, kitLabel },
    { productId: gorraId, quantity: n, kitGroupId, kitLabel },
    { productId: lanyardId, quantity: n * LANYARD_PER_KIT, kitGroupId, kitLabel },
    { productId: playera.id, quantity: n, kitGroupId, kitLabel },
  ];
}

type GroupableItem = {
  id: string;
  quantity: number;
  kitGroupId?: string | null;
  kitLabel?: string | null;
};

export type GroupedRow<T extends GroupableItem> =
  | { key: string; kind: "kit"; label: string; kitQty: number; pieces: T[] }
  | { key: string; kind: "item"; item: T };

// Agrupa las piezas de un mismo kit en una fila; las sueltas quedan aparte.
// kitQty = menor cantidad del grupo (mochila/gorra/playera = N; lanyard = 2N).
export function groupColectaItems<T extends GroupableItem>(items: T[]): GroupedRow<T>[] {
  const groups = new Map<string, T[]>();
  const rows: GroupedRow<T>[] = [];

  for (const it of items) {
    if (it.kitGroupId) {
      const arr = groups.get(it.kitGroupId) ?? [];
      arr.push(it);
      groups.set(it.kitGroupId, arr);
    } else {
      rows.push({ key: it.id, kind: "item", item: it });
    }
  }

  for (const [gid, pieces] of groups) {
    rows.push({
      key: gid,
      kind: "kit",
      label: pieces.find((p) => p.kitLabel)?.kitLabel ?? "Kit",
      kitQty: Math.min(...pieces.map((p) => p.quantity)),
      pieces,
    });
  }

  return rows;
}
