import { describe, expect, it } from "vitest";
import { BR_ELEVATION_REGIONS, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES } from "@planetfall/shared";
import { buildBrTransitCourtDressing } from "./br-transit-court";

const inputs = { structures: BR_STRUCTURES, roads: BR_ROADS, elevationRegions: BR_ELEVATION_REGIONS, retainingBlocks: BR_MAP_BLOCKS };
const region = BR_ELEVATION_REGIONS.find(r => r.districtId === "transit-court")!;
const half = (p: NonNullable<ReturnType<typeof buildBrTransitCourtDressing>>["parts"][number]) => ({
  x: p.scale.x * (p.geometry === "box" ? .5 : 1),
  y: p.scale.y * (p.geometry === "octahedron" ? 1 : .5),
  z: p.scale.z * (p.geometry === "box" ? .5 : 1),
});
const gap = (x: number, z: number, p: { position: { x: number; z: number } }, h: { x: number; z: number }) =>
  Math.hypot(Math.max(0, Math.abs(x - p.position.x) - h.x), Math.max(0, Math.abs(z - p.position.z) - h.z));

describe("Transit Court authored presentation", () => {
  it("is deterministic, bounded and batches every part without changing authoritative inputs", () => {
    const before = JSON.stringify(inputs), court = buildBrTransitCourtDressing()!;
    expect(court.parts.length).toBeLessThan(200);
    expect(court.parts.length).toBeGreaterThan(60);
    expect(court.batches.flatMap(batch => batch.parts)).toHaveLength(court.parts.length);
    expect(new Set(court.batches.flatMap(batch => batch.parts)).size).toBe(court.parts.length);
    expect(court.batches.length).toBeLessThan(16);
    expect(buildBrTransitCourtDressing()).toEqual(court);
    expect(JSON.stringify(inputs)).toBe(before);
    expect(buildBrTransitCourtDressing({ ...inputs, elevationRegions: [] })).toBeUndefined();
    for (const p of court.parts) {
      const h = half(p);
      expect([...Object.values(p.position), ...Object.values(p.scale), p.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(n => n > 0)).toBe(true);
      expect(p.position.y - h.y).toBeGreaterThanOrEqual(region.height - 1e-8);
      expect(Math.abs(p.position.x - region.x) + h.x).toBeLessThanOrEqual(region.width / 2 + .05);
      expect(Math.abs(p.position.z - region.z) + h.z).toBeLessThanOrEqual(region.depth / 2 + .05);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(Math.hypot(p.position.x + sx * h.x - court.center.x,
        p.position.z + sz * h.z - court.center.z)).toBeLessThan(court.radius);
      if (p.surface) expect(p.position.y + h.y).toBeLessThanOrEqual(region.height + .041);
    }
  });

  it("links every door to the sidewalks and leaves clear movement and loot approaches", () => {
    const court = buildBrTransitCourtDressing()!;
    for (const s of BR_STRUCTURES.filter(s => s.districtId === "transit-court")) {
      const path = court.parts.find(p => p.name === `${s.id}-entry-path`)!;
      const direction = s.entrance === "east" ? 1 : -1, facade = s.position.x + direction * s.size.x / 2;
      expect(path.position.z).toBe(s.position.z);
      expect(path.scale.z).toBe(3.2);
      expect(path.position.x - direction * path.scale.x / 2).toBeCloseTo(facade);
      for (const p of court.parts.filter(p => !p.surface)) {
        const h = half(p);
        // The full facade-to-street approach, including a 2m wide doorway.
        expect(Math.abs(p.position.z - s.position.z) > h.z + 2 ||
          Math.abs(p.position.x - path.position.x) > h.x + path.scale.x / 2, `${p.name}: ${s.id}`).toBe(true);
      }
      const sign = court.signs.find(sign => sign.position.z === s.position.z)!;
      expect(sign.position.y - sign.height / 2).toBeGreaterThan(s.position.y + 3);
    }
    for (const p of court.parts) for (const loot of BR_LOOT_SOCKETS.filter(l => l.districtId === "transit-court")) {
      expect(gap(loot.position.x, loot.position.z, p, half(p)), `${p.name}: ${loot.id}`).toBeGreaterThan(1);
    }
  });

  it("keeps the main street, both grades and cross-street free of added geometry", () => {
    const court = buildBrTransitCourtDressing()!;
    const roads = BR_ROADS.filter(r => r.id.startsWith("transit-court-main") || r.id === "transit-court-crosswalk");
    for (const p of court.parts) for (const road of roads) {
      // Point-to-box distance over the road centreline tests entire footprints,
      // rather than only testing decoration centres against street bounds.
      const steps = Math.ceil(Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z) * 4);
      for (let n = 0; n <= steps; n++) expect(gap(road.from.x + (road.to.x - road.from.x) * n / steps,
        road.from.z + (road.to.z - road.from.z) * n / steps, p, half(p)), `${p.name}: ${road.id}`).toBeGreaterThanOrEqual(road.width / 2);
    }
  });

  it("derives ground heights from input and adds only thin trim to retaining geometry", () => {
    const court = buildBrTransitCourtDressing()!;
    const shifted = buildBrTransitCourtDressing({ ...inputs,
      elevationRegions: inputs.elevationRegions.map(r => ({ ...r, height: r.height - 2 })),
      structures: inputs.structures.map(s => ({ ...s, position: { ...s.position, y: s.position.y - 2 } })),
      retainingBlocks: inputs.retainingBlocks.map(b => ({ ...b, position: { ...b.position, y: b.position.y - 2 } })),
    })!;
    court.parts.forEach((p, i) => expect(shifted.parts[i].position.y).toBeCloseTo(p.position.y - 2));
    for (const p of court.parts.filter(p => p.name.includes("-retaining-"))) {
      const wall = BR_MAP_BLOCKS.find(b => p.name.startsWith(`${b.id}-`))!;
      expect(wall.kind).toBe("wall");
      const vertical = wall.size.x < wall.size.z;
      expect(vertical ? p.scale.x : p.scale.z).toBe(.024);
      expect(p.position.y + p.scale.y / 2).toBeLessThanOrEqual(wall.position.y + wall.size.y / 2);
    }
    const stems = court.parts.filter(p => p.name.endsWith("tree-stem"));
    expect(stems).toHaveLength(3);
    for (const stem of stems) { expect(stem.scale.y).toBeGreaterThan(5); expect(stem.scale.x).toBeLessThan(.2); }
  });
});
