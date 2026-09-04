import { describe, it, expect } from "vitest";
import {
  inventoryWhere,
  productWhere,
  canAccessWarehouse,
  type Scope,
} from "./scope-logic";

const ORG = "org-mp";
const WH_KAREN = "wh-karen";
const WH_KARLA = "wh-karla";

const karen: Scope = { userId: "u1", userOrgId: ORG, userRole: "USER_MP", isAdmin: false, warehouseId: WH_KAREN };
const karla: Scope = { userId: "u2", userOrgId: ORG, userRole: "USER_MP", isAdmin: false, warehouseId: WH_KARLA };
const sinRestringir: Scope = { userId: "u3", userOrgId: ORG, userRole: "USER_MP", isAdmin: false, warehouseId: null };
const admin: Scope = { userId: "u4", userOrgId: "org-gi", userRole: "ADMIN_GI", isAdmin: true, warehouseId: null };

describe("inventoryWhere", () => {
  it("restringe al almacén asignado, ignorando la organización", () => {
    expect(inventoryWhere(karen, ORG)).toEqual({ warehouseId: WH_KAREN });
  });

  it("Karen y Karla, en la MISMA organización, nunca comparten filtro", () => {
    expect(inventoryWhere(karen, ORG)).not.toEqual(inventoryWhere(karla, ORG));
  });

  it("sin almacén asignado filtra por organización", () => {
    expect(inventoryWhere(sinRestringir, ORG)).toEqual({ product: { organizationId: ORG } });
  });

  it("admin sin organización objetivo no filtra nada", () => {
    expect(inventoryWhere(admin)).toEqual({});
  });
});

describe("productWhere", () => {
  it("restringido: solo productos con inventario en su almacén", () => {
    expect(productWhere(karen, ORG)).toEqual({
      organizationId: ORG,
      inventoryItems: { some: { warehouseId: WH_KAREN } },
    });
  });

  it("sin restringir: todos los productos de la organización", () => {
    expect(productWhere(sinRestringir, ORG)).toEqual({ organizationId: ORG });
  });

  it("nunca deja de filtrar por organización", () => {
    expect(productWhere(karen, ORG)).toHaveProperty("organizationId", ORG);
    expect(productWhere(sinRestringir, ORG)).toHaveProperty("organizationId", ORG);
  });
});

describe("canAccessWarehouse", () => {
  it("el admin entra a cualquier almacén", () => {
    expect(canAccessWarehouse(admin, WH_KAREN)).toBe(true);
    expect(canAccessWarehouse(admin, WH_KARLA)).toBe(true);
  });

  it("un usuario restringido solo entra al suyo", () => {
    expect(canAccessWarehouse(karen, WH_KAREN)).toBe(true);
    expect(canAccessWarehouse(karen, WH_KARLA)).toBe(false);
  });

  it("un almacén nulo o desconocido se rechaza para el usuario restringido", () => {
    expect(canAccessWarehouse(karen, null)).toBe(false);
    expect(canAccessWarehouse(karen, undefined)).toBe(false);
    expect(canAccessWarehouse(karen, "wh-que-no-existe")).toBe(false);
  });

  it("un usuario sin restricción conserva el comportamiento anterior", () => {
    expect(canAccessWarehouse(sinRestringir, WH_KARLA)).toBe(true);
  });
});
