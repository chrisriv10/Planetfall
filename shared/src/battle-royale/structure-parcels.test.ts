import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_ROADS } from "./index.js";

describe("authored building parcels", () => {
  it("never overlaps independent building interiors at the same elevation", () => {
    for (let i = 0; i < BR_STRUCTURES.length; i++) {
      for (const b of BR_STRUCTURES.slice(i + 1)) {
        const a = BR_STRUCTURES[i];
        const overlapX = (a.size.x + b.size.x) / 2 - Math.abs(a.position.x - b.position.x);
        const overlapZ = (a.size.z + b.size.z) / 2 - Math.abs(a.position.z - b.position.z);
        const overlapY = Math.min(a.position.y + a.size.y, b.position.y + b.size.y) - Math.max(a.position.y, b.position.y);
        expect(overlapX > 0 && overlapZ > 0 && overlapY > 0, `${a.id} intersects ${b.id}`).toBe(false);
      }
    }
  });

  it("reserves independent Nova market/hotel parcels and their circulation shoulders", () => {
    const hotel = BR_STRUCTURES.find(s => s.id === "nova-hotel")!;
    const tower = BR_STRUCTURES.find(s => s.id === "nova-tower-b")!;
    const market = BR_STRUCTURES.find(s => s.id === "nova-market")!;
    const studio = BR_STRUCTURES.find(s => s.id === "nova-studio")!;
    expect(hotel.position.z + hotel.size.z / 2).toBeLessThanOrEqual(tower.position.z - tower.size.z / 2 - 3);
    expect(market.position.x - market.size.x / 2).toBeGreaterThanOrEqual(studio.position.x + studio.size.x / 2 + 8);
    expect(market.entrance).toBe("east");
    const south = BR_ROADS.find(r => r.id === "ring-nova-south")!;
    const east = BR_ROADS.find(r => r.id === "ring-nova-east")!;
    expect(hotel.position.z - hotel.size.z / 2).toBeGreaterThanOrEqual(south.from.z + south.width / 2 + 1.5);
    expect(market.position.x + market.size.x / 2).toBeLessThanOrEqual(east.from.x - east.width / 2 - 3);
  });
});
