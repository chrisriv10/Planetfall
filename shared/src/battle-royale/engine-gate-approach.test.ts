import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES } from "./index.js";

const ids = ["engine-gate-approach-workshop", "engine-gate-approach-relay"];
describe("Dock–Engine occupied approach frontage", () => {
  it("appends two real, enterable approach buildings without moving the secondary block", () => {
    expect(BR_STRUCTURES.slice(183,185).map(s => s.id)).toEqual(ids);
    const plan = BR_DISTRICT_PLANS.find(p => p.id === "engine-gate")!;
    expect(plan.parcels.map(p => p.id)).toEqual(["engine-gate-parcel-1", "engine-gate-parcel-2", "engine-gate-parcel-3"]);
    expect(plan.origin).toEqual({ x:405, y:0, z:-180 });
    for (const id of ids) {
      const building = BR_STRUCTURES.find(s => s.id === id)!;
      expect(building.enterable).toBe(true);
      expect(building.districtId).toBe("thruster-works");
      expect(building.entrance).toBe("east");
      expect(building.position.y).toBe(0);
      expect(building.roofAccess).toBe(false);
      expect(BR_MAP_BLOCKS.find(b => b.id === `${id}-floor`)).toBeDefined();
      expect(BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${id}-`) && b.kind === "wall")).toHaveLength(6);
      expect(BR_MAP_BLOCKS.find(b=>b.id===`${id}-entrance-header`)).toBeDefined();
      const loot = BR_LOOT_SOCKETS.filter(l => l.structureId === id);
      expect(loot).toHaveLength(2);
      expect(loot.every(l => l.kind === "interior")).toBe(true);
    }
    expect(BR_STRUCTURES.find(s => s.id === "engine-gate-1")!.position).toEqual({ x:385, y:0, z:-163 });
    expect(BR_ROADS.find(r => r.id === "dock-engine-link-east")!.to).toEqual({ x:340, y:.1, z:-180 });
  });

  it("leaves the existing eight-metre through-road and both doorway approaches clear", () => {
    const road = BR_ROADS.find(r => r.id === "dock-engine-link-east")!;
    const extension = BR_ROADS.find(r => r.id === "engine-gate-approach-through")!;
    const ring = BR_ROADS.find(r => r.id === "ring-thruster-south")!;
    expect(extension.from).toEqual(road.to);
    expect(extension.width).toBe(road.width);
    expect(extension.to.z).toBe(ring.from.z);
    expect(extension.to.y).toBe(ring.from.y);
    expect(extension.to.x).toBeGreaterThan(ring.from.x);
    expect(extension.to.x).toBeLessThan(ring.to.x);
    for (const id of ids) {
      const s = BR_STRUCTURES.find(s => s.id === id)!;
      expect(road.from.x - road.width/2 - (s.position.x+s.size.x/2)).toBe(10);
      for (const z of [s.position.z-s.size.z/2,s.position.z,s.position.z+s.size.z/2]) {
        expect(z).toBeGreaterThan(road.from.z);
        expect(z).toBeLessThan(extension.to.z);
      }
      // This corridor is also the authoritative test path into the open door.
      for (const other of BR_STRUCTURES.filter(b => !ids.includes(b.id))) {
        const crossesX = other.position.x+other.size.x/2>325 && other.position.x-other.size.x/2<340;
        const crossesZ = Math.abs(other.position.z-s.position.z)<other.size.z/2+1.6;
        expect(crossesX && crossesZ, `${id} approach / ${other.id}`).toBe(false);
      }
    }
  });

  it("frames the confirmed gap with nearby physical enclosure rather than decorative props", () => {
    const gap = { x:320, z:-180 };
    const distances = ids.map(id => {
      const s=BR_STRUCTURES.find(s=>s.id===id)!;
      return Math.hypot(Math.max(0,Math.abs(gap.x-s.position.x)-s.size.x/2),Math.max(0,Math.abs(gap.z-s.position.z)-s.size.z/2));
    });
    expect(Math.min(...distances)).toBe(9);
    expect(Math.max(...distances)).toBe(10);
  });
});
