import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL } from "@planetfall/shared";
import { BR_CORRIDOR_GROVE_MAX, BR_CORRIDOR_TREES_PER_GROVE, buildBrCorridorGroves } from "./br-corridor-groves";

const segmentDistance = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

describe("BR corridor groves", () => {
  it("is deterministic, bounded, and keeps trunks out of roads and buildings", () => {
    const first = buildBrCorridorGroves();
    expect(buildBrCorridorGroves()).toEqual(first);
    const trunks = first.filter(part => part.geometry === "cylinder");
    expect(trunks.length).toBeGreaterThanOrEqual(16);
    expect(trunks.length).toBeLessThanOrEqual(BR_CORRIDOR_GROVE_MAX * BR_CORRIDOR_TREES_PER_GROVE);
    for (const trunk of trunks) {
      expect(BR_STRUCTURES.every(structure => Math.abs(trunk.position.x - structure.position.x) > structure.size.x / 2
        || Math.abs(trunk.position.z - structure.position.z) > structure.size.z / 2)).toBe(true);
      expect(BR_ROADS.every(road => {
        const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, squared = dx * dx + dz * dz;
        const t = squared ? Math.max(0, Math.min(1, ((trunk.position.x - road.from.x) * dx + (trunk.position.z - road.from.z) * dz) / squared)) : 0;
        return Math.hypot(trunk.position.x - road.from.x - dx * t, trunk.position.z - road.from.z - dz * t) > road.width / 2 + 4;
      })).toBe(true);
    }
  });

  it("composes bounded planter groups with airy crowns, low edging, and correctly aligned broken guides", () => {
    const before = JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TRAVERSAL, BR_ISLAND_OUTLINE]);
    const parts = buildBrCorridorGroves();
    expect(parts.length % 25).toBe(0);
    expect(parts.length).toBeLessThanOrEqual(BR_CORRIDOR_GROVE_MAX * 25);
    for (let i = 0; i < parts.length; i += 25) {
      const kit = parts.slice(i, i + 25);
      const trunks = kit.filter(part => part.geometry === "cylinder");
      const crowns = kit.filter(part => part.geometry === "octahedron");
      const rails = kit.filter(part => part.finish === "brushedMetal");
      const guides = kit.filter(part => part.finish === "sidewalk");
      expect(trunks).toHaveLength(4); expect(crowns).toHaveLength(6);
      expect(rails).toHaveLength(8); expect(guides).toHaveLength(3);
      expect(rails.every(part => part.scale.y === .1 && part.scale.z === .09)).toBe(true);
      expect(kit.filter(part => part.geometry === "box").every(part => part.position.y + part.scale.y / 2 <= .21 + 1e-9)).toBe(true);
      expect(trunks.every(part => part.scale.x === .16 && part.scale.z === .16)).toBe(true);
      const dx = trunks[2].position.x - trunks[0].position.x;
      const dz = trunks[2].position.z - trunks[0].position.z;
      const length = Math.hypot(dx, dz);
      for (const guide of guides) {
        expect(Math.cos(guide.rotationY)).toBeCloseTo(dx / length);
        expect(-Math.sin(guide.rotationY)).toBeCloseTo(dz / length);
      }
      expect(Math.hypot(guides[1].position.x - guides[0].position.x,
        guides[1].position.z - guides[0].position.z) - guides[0].scale.x).toBeCloseTo(.4);
    }
    expect(JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TRAVERSAL, BR_ISLAND_OUTLINE])).toBe(before);
  });

  it("protects whole finite part footprints against island edges, roads, buildings, ramps and traversal", () => {
    for (const part of buildBrCorridorGroves()) {
      expect([...Object.values(part.position), part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      const radius = part.geometry === "box" ? Math.hypot(part.scale.x, part.scale.z) / 2 : Math.max(part.scale.x, part.scale.z);
      for (const road of BR_ROADS) expect(segmentDistance(part.position, road.from, road.to)).toBeGreaterThanOrEqual(road.width / 2 + radius + 2);
      for (const structure of BR_STRUCTURES) {
        const dx = Math.max(0, Math.abs(part.position.x - structure.position.x) - structure.size.x / 2);
        const dz = Math.max(0, Math.abs(part.position.z - structure.position.z) - structure.size.z / 2);
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(radius + 2);
      }
      expect(BR_MAP_BLOCKS.every(block => Math.hypot(part.position.x - block.position.x, part.position.z - block.position.z)
        >= Math.hypot(block.size.x, block.size.y, block.size.z) / 2 + radius + 1)).toBe(true);
      for (const item of BR_TRAVERSAL) expect(Math.hypot(part.position.x - item.position.x, part.position.z - item.position.z)).toBeGreaterThanOrEqual(radius + 6);
      let inside = false;
      for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
        const [x, z] = BR_ISLAND_OUTLINE[i], [px, pz] = BR_ISLAND_OUTLINE[j];
        expect(segmentDistance(part.position, { x, z }, { x: px, z: pz })).toBeGreaterThanOrEqual(radius + 1);
        if ((z > part.position.z) !== (pz > part.position.z)
          && part.position.x < (px - x) * (part.position.z - z) / (pz - z) + x) inside = !inside;
      }
      expect(inside).toBe(true);
    }
  });

  it("omits blocked and malformed layouts without weakening clearance", () => {
    expect(buildBrCorridorGroves({ outline: [] })).toEqual([]);
    expect(buildBrCorridorGroves({ roads: [] })).toEqual([]);
    expect(buildBrCorridorGroves({ roads: [{ ...BR_ROADS[0], width: NaN }] })).toEqual([]);
    const original = buildBrCorridorGroves();
    const traversal = original.filter(part => part.geometry === "cylinder").map(part => ({ position: part.position }));
    const changed = buildBrCorridorGroves({ traversal });
    expect(changed.every(part => traversal.every(item => Math.hypot(part.position.x - item.position.x, part.position.z - item.position.z) >= 6))).toBe(true);
  });
});
