import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_STRUCTURES, BR_WEAPONS, isBrWeapon } from "@planetfall/shared";
import { generateBrLoot } from "./br-loot-generation";

describe("BR authored loot distribution", () => {
  it("gives every enterable structure a weapon with compatible ammunition", () => {
    let id = 0;
    const loot = generateBrLoot(BR_LOOT_SOCKETS, 20260924, (kind) => `${kind}-${id++}`);
    for (const structure of BR_STRUCTURES.filter((entry) => entry.enterable)) {
      const socketIds = new Set(BR_LOOT_SOCKETS.filter((entry) => entry.structureId === structure.id).map((entry) => entry.id));
      const sockets = BR_LOOT_SOCKETS.filter((entry) => socketIds.has(entry.id));
      const near = loot.filter((entry) => sockets.some((socket) => Math.hypot(entry.position.x-socket.position.x,entry.position.z-socket.position.z)<2));
      const weapon = near.find((entry) => entry.itemId && isBrWeapon(entry.itemId));
      expect(weapon, structure.id).toBeTruthy();
      const ammoType = weapon?.itemId && isBrWeapon(weapon.itemId) ? BR_WEAPONS[weapon.itemId].ammo : null;
      if (ammoType) expect(near.some((entry) => entry.ammoType === ammoType), structure.id).toBe(true);
    }
  });

  it("is deterministic, varied and denser than one item per structure", () => {
    const make = (seed:number) => generateBrLoot(BR_LOOT_SOCKETS, seed, (kind) => `${kind}`)
      .map((entry) => `${entry.itemId ?? entry.ammoType}:${entry.rarity}`);
    expect(make(7)).toEqual(make(7));
    expect(make(7)).not.toEqual(make(8));
    expect(make(7).length).toBeGreaterThan(BR_STRUCTURES.filter((entry)=>entry.enterable).length * 1.5);
  });
});
