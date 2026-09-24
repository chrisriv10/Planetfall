import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL } from "@planetfall/shared";
import { BR_DECK_TRANSITION_RADIUS, buildDeckTransitions, existingDeckTransitionReservations } from "./br-deck-transitions";

const distanceToSegment = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
const rectDistance = (x: number, z: number, p: { x: number; z: number }, s: { x: number; z: number }, angle = 0) => {
  const lx = (x - p.x) * Math.cos(angle) - (z - p.z) * Math.sin(angle);
  const lz = (x - p.x) * Math.sin(angle) + (z - p.z) * Math.cos(angle);
  return Math.hypot(Math.max(0, Math.abs(lx) - s.x / 2), Math.max(0, Math.abs(lz) - s.z / 2));
};

describe("flush district approach deck transitions", () => {
  it("is deterministic, sparse, budgeted and leaves authored data unchanged", () => {
    const before = JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES, BR_SECONDARY_LOCATIONS]);
    const sites = buildDeckTransitions();
    expect(sites.length).toBeGreaterThanOrEqual(3);
    expect(sites.length).toBeLessThanOrEqual(12);
    expect(sites.reduce((sum, site) => sum + site.parts.length, 0)).toBeLessThanOrEqual(120);
    expect(buildDeckTransitions()).toEqual(sites);
    expect(buildDeckTransitions({ roads: [...BR_ROADS].reverse(), patches: [...BR_TERRAIN_PATCHES].reverse() })).toEqual(sites);
    expect(new Set(sites.map(site => site.roadId)).size).toBe(sites.length);
    expect(JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES, BR_SECONDARY_LOCATIONS])).toBe(before);
  });

  it("uses small dark plates with materially less covered area and a clear deck gap", () => {
    for (const site of buildDeckTransitions()) {
      const plates = site.parts.filter(part => part.layer === 6);
      expect(plates).toHaveLength(2);
      for (const plate of plates) {
        expect(plate.finish).toBe("paintedMetal");
        expect(plate.scale.x).toBeLessThanOrEqual(5.4);
        expect(plate.scale.z).toBeLessThanOrEqual(5.8);
      }
      // Includes overlapping hatch/marking area, a conservative upper bound.
      // Former panel surfaces alone covered 95.04m²; the entire kit is <58m².
      expect(site.parts.reduce((area, part) => area + part.scale.x * part.scale.z, 0)).toBeLessThan(58);
      const localX = (part: (typeof site.parts)[number]) =>
        (part.position.x - site.center.x) * Math.cos(part.rotationY)
        - (part.position.z - site.center.z) * Math.sin(part.rotationY);
      const sorted = [...plates].sort((a, b) => localX(a) - localX(b));
      expect(localX(sorted[1]) - sorted[1].scale.x / 2 - localX(sorted[0]) - sorted[0].scale.x / 2).toBeGreaterThanOrEqual(1.99);
      // No seam, marking or hatch bridges the exposed center strip.
      for (const part of site.parts) expect(Math.abs(localX(part)) - part.scale.x / 2).toBeGreaterThan(.99);
    }
  });

  it("reserves full footprints away from roads, entrances and all gameplay blocks", () => {
    const radius = BR_DECK_TRANSITION_RADIUS;
    for (const site of buildDeckTransitions()) {
      const { x, z } = site.center;
      for (const road of BR_ROADS) {
        expect(distanceToSegment(x, z, road.from, road.to)).toBeGreaterThanOrEqual(road.width / 2 + radius + 3);
        expect(Math.min(Math.hypot(x - road.from.x, z - road.from.z), Math.hypot(x - road.to.x, z - road.to.z))).toBeGreaterThanOrEqual(radius + 20);
      }
      for (const structure of BR_STRUCTURES) expect(rectDistance(x, z, structure.position, structure.size)).toBeGreaterThanOrEqual(radius + 4);
      for (const block of BR_MAP_BLOCKS) {
        const gap = block.rotation ? Math.hypot(x - block.position.x, z - block.position.z) - Math.hypot(block.size.x, block.size.y, block.size.z) / 2
          : rectDistance(x, z, block.position, block.size);
        expect(gap).toBeGreaterThanOrEqual(radius + 3);
      }
      for (const t of BR_TRAVERSAL) expect(Math.hypot(x - t.position.x, z - t.position.z)).toBeGreaterThanOrEqual(radius + 8);
    }
  });

  it("does not overlap terrain treatments or existing secondary and roadside kits", () => {
    const radius = BR_DECK_TRANSITION_RADIUS;
    const reservations = existingDeckTransitionReservations();
    const sites = buildDeckTransitions();
    for (const [index, site] of sites.entries()) {
      const { x, z } = site.center;
      for (const patch of BR_TERRAIN_PATCHES) expect(rectDistance(x, z, patch.position, patch.size, patch.rotation)).toBeGreaterThanOrEqual(radius + 2);
      for (const location of BR_SECONDARY_LOCATIONS) expect(Math.hypot(x - location.position.x, z - location.position.z)).toBeGreaterThanOrEqual(radius + 40);
      for (const reservation of reservations) expect(Math.hypot(x - reservation.position.x, z - reservation.position.z)).toBeGreaterThanOrEqual(radius + reservation.radius + 2);
      for (const other of sites.slice(index + 1)) expect(Math.hypot(x - other.center.x, z - other.center.z)).toBeGreaterThanOrEqual(radius * 2 + 6);
    }
  });

  it("keeps every finite rotated corner inside its reserved footprint and the island, with tops below 6cm", () => {
    for (const site of buildDeckTransitions()) for (const part of site.parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(v => Number.isFinite(v) && v > 0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
      expect(part.position.y + part.scale.y / 2).toBeLessThanOrEqual(.06);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = part.position.x + Math.cos(part.rotationY) * sx * part.scale.x / 2 + Math.sin(part.rotationY) * sz * part.scale.z / 2;
        const z = part.position.z - Math.sin(part.rotationY) * sx * part.scale.x / 2 + Math.cos(part.rotationY) * sz * part.scale.z / 2;
        expect(Math.hypot(x - site.center.x, z - site.center.z)).toBeLessThan(BR_DECK_TRANSITION_RADIUS);
        let inside = false;
        for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
          const [ax, az] = BR_ISLAND_OUTLINE[i], [bx, bz] = BR_ISLAND_OUTLINE[j];
          if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
          expect(distanceToSegment(x, z, { x: ax, z: az }, { x: bx, z: bz })).toBeGreaterThan(3);
        }
        expect(inside).toBe(true);
      }
    }
  });

  it("omits invalid or blocked sites instead of reducing the clearances", () => {
    expect(buildDeckTransitions({ roads: [], reserved: [] })).toEqual([]);
    expect(buildDeckTransitions({ patches: [], reserved: [] })).toEqual([]);
    expect(buildDeckTransitions({ outline: [[0, 0], [1, 0], [0, 1]], reserved: [] })).toEqual([]);
    expect(buildDeckTransitions({ roads: [{ ...BR_ROADS[0], width: NaN }], reserved: [] })).toEqual([]);
    expect(buildDeckTransitions({ reserved: [{ position: { x: 0, y: 0, z: 0 }, radius: 2000 }] })).toEqual([]);
  });
});
