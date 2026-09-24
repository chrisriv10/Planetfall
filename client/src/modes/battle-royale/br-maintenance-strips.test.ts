import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL, type BrRoadSegment } from "@planetfall/shared";
import { buildMaintenanceStrips } from "./br-maintenance-strips";

const segmentDistance = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
const road: BrRoadSegment = { id: "test-long-road", from: { x: -120, y: 0, z: 0 }, to: { x: 120, y: 0, z: 0 }, width: 10, color: "#fff" };
const empty = { roads: [road], structures: [], blocks: [], traversal: [], outline: [[-250, -250], [250, -250], [250, 250], [-250, 250]] as const };

describe("BR flush corridor maintenance strips", () => {
  it("is deterministic, input-order independent and bounded on the real map", () => {
    const before = JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS]);
    const strips = buildMaintenanceStrips();
    expect(strips.length).toBeGreaterThanOrEqual(8);
    expect(strips.length).toBeLessThanOrEqual(18);
    expect(strips.reduce((sum, strip) => sum + strip.parts.length, 0)).toBeLessThanOrEqual(198);
    expect(buildMaintenanceStrips()).toEqual(strips);
    expect(buildMaintenanceStrips({ roads: [...BR_ROADS].reverse() })).toEqual(strips);
    expect(JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS])).toBe(before);
    for (const id of new Set(strips.map(strip => strip.roadId))) expect(strips.filter(strip => strip.roadId === id).length).toBeLessThanOrEqual(2);
  });

  it("reserves a whole footprint clear of roads, endpoints, structures, cover and traversal", () => {
    const strips = buildMaintenanceStrips();
    for (const [index, strip] of strips.entries()) {
      const { x, z } = strip.center;
      for (const route of BR_ROADS) {
        expect(segmentDistance(x, z, route.from, route.to)).toBeGreaterThanOrEqual(route.width / 2 + 8.5);
        expect(Math.min(Math.hypot(x - route.from.x, z - route.from.z), Math.hypot(x - route.to.x, z - route.to.z))).toBeGreaterThanOrEqual(30.5);
      }
      for (const structure of BR_STRUCTURES) {
        const dx = Math.max(0, Math.abs(x - structure.position.x) - structure.size.x / 2);
        const dz = Math.max(0, Math.abs(z - structure.position.z) - structure.size.z / 2);
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(10.5);
      }
      for (const block of BR_MAP_BLOCKS.filter(b => ["cover", "ramp", "bridge"].includes(b.kind))) {
        expect(Math.hypot(x - block.position.x, z - block.position.z))
          .toBeGreaterThanOrEqual(8.5 + Math.hypot(block.size.x, block.size.y, block.size.z) / 2);
      }
      for (const traversal of BR_TRAVERSAL) expect(Math.hypot(x - traversal.position.x, z - traversal.position.z)).toBeGreaterThanOrEqual(14.5);
      for (const other of strips.slice(index + 1)) expect(Math.hypot(x - other.center.x, z - other.center.z)).toBeGreaterThanOrEqual(24);
      let inside = false;
      for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
        const [ax, az] = BR_ISLAND_OUTLINE[i], [bx, bz] = BR_ISLAND_OUTLINE[j];
        if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
        expect(segmentDistance(x, z, { x: ax, z: az }, { x: bx, z: bz })).toBeGreaterThanOrEqual(8.5);
      }
      expect(inside).toBe(true);
    }
  });

  it("keeps rotated part corners within the tested footprint and below apparent cover height", () => {
    const diagonal = { ...road, to: { x: 100, y: 0, z: 100 } };
    for (const strip of [...buildMaintenanceStrips(), ...buildMaintenanceStrips({ ...empty, roads: [diagonal] })]) {
      for (const part of strip.parts) {
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Number.isFinite(part.rotationY)).toBe(true);
        expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(.08);
        expect(part.position.y - part.scale.y / 2).toBeGreaterThan(.03);
        const cos = Math.cos(part.rotationY), sin = Math.sin(part.rotationY);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = part.position.x + cos * sx * part.scale.x / 2 + sin * sz * part.scale.z / 2;
          const z = part.position.z - sin * sx * part.scale.x / 2 + cos * sz * part.scale.z / 2;
          expect(Math.hypot(x - strip.center.x, z - strip.center.z)).toBeLessThan(6.5);
        }
      }
    }
  });

  it("omits unsafe or malformed corridors instead of relaxing clearance", () => {
    expect(buildMaintenanceStrips(empty).length).toBe(2);
    expect(buildMaintenanceStrips({ ...empty, outline: [[0, 0], [1, 0], [0, 1]] })).toEqual([]);
    expect(buildMaintenanceStrips({ ...empty, roads: [{ ...road, to: road.from }, { ...road, width: NaN }] })).toEqual([]);
    const blockingStructure = { ...BR_STRUCTURES[0], position: { x: 0, y: 0, z: 0 }, size: { x: 500, y: 10, z: 500 } };
    expect(buildMaintenanceStrips({ ...empty, structures: [blockingStructure] })).toEqual([]);
    const blocked = buildMaintenanceStrips(empty).map(strip => ({ position: strip.center }));
    const result = buildMaintenanceStrips({ ...empty, traversal: blocked });
    for (const strip of result) for (const t of blocked) expect(Math.hypot(strip.center.x - t.position.x, strip.center.z - t.position.z)).toBeGreaterThanOrEqual(14.5);
  });
});
