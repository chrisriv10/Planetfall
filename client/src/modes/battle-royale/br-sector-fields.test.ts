import { describe, expect, it } from "vitest";
import {
  BR_ISLAND_OUTLINE,
  BR_MAP_BLOCKS,
  BR_ROADS,
  BR_SECONDARY_LOCATIONS,
  BR_STRUCTURES,
  BR_TERRAIN_PATCHES,
  BR_TRAVERSAL,
  type BrRoadSegment
} from "@planetfall/shared";
import { BR_SECTOR_FIELD_RADIUS, buildBrSectorFields } from "./br-sector-fields";

const distanceToSegment = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / squared)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
const boxDistance = (x: number, z: number, p: { x: number; z: number }, s: { x: number; z: number }, rotation = 0) => {
  const localX = (x - p.x) * Math.cos(rotation) - (z - p.z) * Math.sin(rotation);
  const localZ = (x - p.x) * Math.sin(rotation) + (z - p.z) * Math.cos(rotation);
  return Math.hypot(Math.max(0, Math.abs(localX) - s.x / 2), Math.max(0, Math.abs(localZ) - s.z / 2));
};

describe("BR broad orbital sector fields", () => {
  it("is deterministic, input-order independent and tightly budgeted", () => {
    const before = JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES, BR_SECONDARY_LOCATIONS]);
    const fields = buildBrSectorFields();
    expect(fields.length).toBeGreaterThanOrEqual(3);
    expect(fields.length).toBeLessThanOrEqual(10);
    expect(fields.reduce((total, field) => total + field.parts.length, 0)).toBeLessThanOrEqual(140);
    expect(buildBrSectorFields()).toEqual(fields);
    expect(buildBrSectorFields({ roads: [...BR_ROADS].reverse() })).toEqual(fields);
    expect(new Set(fields.map(field => field.roadId)).size).toBe(fields.length);
    expect(JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES, BR_SECONDARY_LOCATIONS])).toBe(before);
  });

  it("keeps every whole footprint clear of gameplay and authored presentation", () => {
    const radius = BR_SECTOR_FIELD_RADIUS;
    const fields = buildBrSectorFields();
    for (const [index, field] of fields.entries()) {
      const { x, z } = field.center;
      for (const road of BR_ROADS) {
        expect(distanceToSegment(x, z, road.from, road.to)).toBeGreaterThanOrEqual(road.width / 2 + radius + 3);
        expect(Math.min(Math.hypot(x - road.from.x, z - road.from.z), Math.hypot(x - road.to.x, z - road.to.z))).toBeGreaterThanOrEqual(radius + 22);
      }
      for (const structure of BR_STRUCTURES) expect(boxDistance(x, z, structure.position, structure.size)).toBeGreaterThanOrEqual(radius + 4);
      for (const patch of BR_TERRAIN_PATCHES) expect(boxDistance(x, z, patch.position, patch.size, patch.rotation)).toBeGreaterThanOrEqual(radius + 3);
      for (const location of BR_SECONDARY_LOCATIONS) expect(Math.hypot(x - location.position.x, z - location.position.z)).toBeGreaterThanOrEqual(radius + 40);
      for (const traversal of BR_TRAVERSAL) expect(Math.hypot(x - traversal.position.x, z - traversal.position.z)).toBeGreaterThanOrEqual(radius + 10);
      for (const other of fields.slice(index + 1)) expect(Math.hypot(x - other.center.x, z - other.center.z)).toBeGreaterThanOrEqual(radius * 2 + 8);
    }
  });

  it("uses only flush finite non-cover parts whose corners remain inside the island", () => {
    for (const field of buildBrSectorFields()) for (const part of field.parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
      expect(part.position.y + part.scale.y / 2).toBeLessThan(.05);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(0);
      const cos = Math.cos(part.rotationY), sin = Math.sin(part.rotationY);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = part.position.x + cos * sx * part.scale.x / 2 + sin * sz * part.scale.z / 2;
        const z = part.position.z - sin * sx * part.scale.x / 2 + cos * sz * part.scale.z / 2;
        expect(Math.hypot(x - field.center.x, z - field.center.z)).toBeLessThanOrEqual(BR_SECTOR_FIELD_RADIUS);
        let inside = false;
        for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
          const [ax, az] = BR_ISLAND_OUTLINE[i], [bx, bz] = BR_ISLAND_OUTLINE[j];
          if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
        }
        expect(inside).toBe(true);
      }
    }
  });

  it("omits malformed or blocked candidates rather than relaxing safety", () => {
    const road: BrRoadSegment = { id: "test", from: { x: -150, y: 0, z: 0 }, to: { x: 150, y: 0, z: 0 }, width: 10, color: "#fff" };
    const outline = [[-250, -250], [250, -250], [250, 250], [-250, 250]] as const;
    const empty = { roads: [road], structures: [], blocks: [], locations: [], patches: [], traversal: [], outline, reserved: [] };
    expect(buildBrSectorFields(empty).length).toBeGreaterThan(0);
    expect(buildBrSectorFields({ ...empty, outline: [[0, 0], [1, 0], [0, 1]] })).toEqual([]);
    expect(buildBrSectorFields({ ...empty, roads: [{ ...road, width: NaN }, { ...road, to: road.from }] })).toEqual([]);
    expect(buildBrSectorFields({ ...empty, reserved: [{ position: { x: 0, y: 0, z: 0 }, radius: 2000 }] })).toEqual([]);
  });
});
