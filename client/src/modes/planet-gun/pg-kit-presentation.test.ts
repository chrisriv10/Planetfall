import { describe, expect, it } from "vitest";
import { PG_MODULES, PG_PRIMARY_WEAPONS, PG_SECONDARY_WEAPONS, pgWeaponProfile } from "@planetfall/shared";
import { PG_KIT_SOCKETS, pgKitStatRows, pgSocketModules } from "./pg-kit-presentation";
describe("Combat Kit presentation", () => {
  it("shows only authoritative compatible modules in each socket", () => {
    for (const weapon of [...PG_PRIMARY_WEAPONS, ...PG_SECONDARY_WEAPONS]) for (const socket of PG_KIT_SOCKETS) {
      for (const id of pgSocketModules(weapon, socket)) { expect(PG_MODULES[id].category).toBe(socket); expect(PG_MODULES[id].weapons).toContain(weapon); }
    }
  });
  it("shows exact rounded magazine and reload changes, not percentage estimates", () => {
    const rows = pgKitStatRows("pulse", ["expanded-cell"]), base = pgWeaponProfile("pulse"), profile = pgWeaponProfile("pulse", ["expanded-cell"]);
    expect(rows.find(row => row.name === "Magazine")).toMatchObject({ delta: profile.magazine - base.magazine, benefit: "gain" });
    expect(rows.find(row => row.name === "Reload")).toMatchObject({ deltaText: "+250 ms", benefit: "cost" });
  });
  it("compares combined effects against the unmodified profile", () => {
    const rows = pgKitStatRows("rail", ["gyro-stabilizer", "lightweight-frame"]);
    expect(rows.find(row => row.name === "Recoil")).toMatchObject({ deltaText: "-3.4%", benefit: "gain" });
    expect(pgKitStatRows("rail", []).every(row => row.deltaText === "—")).toBe(true);
  });
});
