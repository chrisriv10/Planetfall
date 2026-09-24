import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE, BR_MAP_BLOCKS, BR_POIS, BR_ROADS, BR_STRUCTURES, BR_TERRAIN_PATCHES, BR_TRAVERSAL } from "@planetfall/shared";
import { BR_CONNECTIVE_CLUSTER_RADIUS, buildConnectiveClusters, connectiveClusterReservations } from "./br-connective-clusters";

const segmentDistance = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, sq = dx * dx + dz * dz;
  const t = sq ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / sq)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
const rectDistance = (x: number, z: number, p: { x: number; z: number }, size: { x: number; z: number }, rotation = 0) => {
  const lx = (x - p.x) * Math.cos(rotation) - (z - p.z) * Math.sin(rotation);
  const lz = (x - p.x) * Math.sin(rotation) + (z - p.z) * Math.cos(rotation);
  return Math.hypot(Math.max(0, Math.abs(lx) - size.x / 2), Math.max(0, Math.abs(lz) - size.z / 2));
};

describe("BR low-density connective pockets", () => {
  it("builds 8–12 deterministic themed clusters without changing shared inputs", () => {
    const before = JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES]);
    const clusters = buildConnectiveClusters();
    expect(clusters.length).toBeGreaterThanOrEqual(8);
    expect(clusters.length).toBeLessThanOrEqual(12);
    expect(new Set(clusters.map(cluster => cluster.theme)).size).toBeGreaterThanOrEqual(3);
    expect(buildConnectiveClusters()).toEqual(clusters);
    expect(buildConnectiveClusters({ roads: [...BR_ROADS].reverse() })).toEqual(clusters);
    expect(clusters.reduce((sum, cluster) => sum + cluster.parts.length, 0)).toBeLessThanOrEqual(140);
    for (const cluster of clusters) {
      expect(cluster.radius).toBe(BR_CONNECTIVE_CLUSTER_RADIUS);
      expect(cluster.parts.length).toBeLessThanOrEqual(14);
    }
    expect(JSON.stringify([BR_ROADS, BR_STRUCTURES, BR_MAP_BLOCKS, BR_TERRAIN_PATCHES])).toBe(before);
  });

  it("keeps the complete radius clear of road, structure, cover, ramp, traversal and other kits", () => {
    const clusters = buildConnectiveClusters(), reservations = connectiveClusterReservations();
    for (const [index, cluster] of clusters.entries()) {
      const { x, z } = cluster.center, r = cluster.radius;
      for (const road of BR_ROADS) {
        expect(segmentDistance(x, z, road.from, road.to)).toBeGreaterThanOrEqual(r + road.width / 2 + 4);
        expect(Math.min(Math.hypot(x - road.from.x, z - road.from.z), Math.hypot(x - road.to.x, z - road.to.z))).toBeGreaterThanOrEqual(r + 25);
      }
      for (const structure of BR_STRUCTURES) expect(rectDistance(x, z, structure.position, structure.size)).toBeGreaterThanOrEqual(r + 5);
      for (const block of BR_MAP_BLOCKS) {
        const gap = block.rotation ? Math.hypot(x - block.position.x, z - block.position.z) - Math.hypot(block.size.x, block.size.y, block.size.z) / 2
          : rectDistance(x, z, block.position, block.size);
        expect(gap).toBeGreaterThanOrEqual(r + 4);
      }
      for (const patch of BR_TERRAIN_PATCHES) expect(rectDistance(x, z, patch.position, patch.size, patch.rotation)).toBeGreaterThanOrEqual(r + 3);
      for (const t of BR_TRAVERSAL) expect(Math.hypot(x - t.position.x, z - t.position.z)).toBeGreaterThanOrEqual(r + 10);
      for (const other of reservations) expect(Math.hypot(x - other.position.x, z - other.position.z)).toBeGreaterThanOrEqual(r + other.radius + 3);
      for (const other of clusters.slice(index + 1)) expect(Math.hypot(x - other.center.x, z - other.center.z)).toBeGreaterThanOrEqual(65);
    }
  });

  it("bounds every finite geometry corner and avoids opaque cover-sized masses", () => {
    for (const cluster of buildConnectiveClusters()) for (const part of cluster.parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n => Number.isFinite(n) && n > 0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
      // Unit cylinder/octahedron radial extents are 1, unlike unitBox's .5.
      const horizontalFactor = part.geometry === "box" ? .5 : 1;
      const verticalFactor = part.geometry === "octahedron" ? 1 : .5;
      const top = part.position.y + part.scale.y * verticalFactor;
      expect(part.position.y - part.scale.y * verticalFactor).toBeGreaterThanOrEqual(-1e-10);
      if (part.surface) expect(top).toBeLessThan(.06);
      else if (part.geometry === "octahedron") expect(top).toBeLessThanOrEqual(.55);
      else if (top > .45) {
        // Only narrow poles/lamp lenses may rise above ankle height.
        expect(part.scale.x * horizontalFactor * 2).toBeLessThanOrEqual(.32);
        expect(part.scale.z * horizontalFactor * 2).toBeLessThanOrEqual(.32);
        expect(top).toBeLessThanOrEqual(3);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = part.position.x + Math.cos(part.rotationY) * sx * part.scale.x * horizontalFactor + Math.sin(part.rotationY) * sz * part.scale.z * horizontalFactor;
        const z = part.position.z - Math.sin(part.rotationY) * sx * part.scale.x * horizontalFactor + Math.cos(part.rotationY) * sz * part.scale.z * horizontalFactor;
        expect(Math.hypot(x - cluster.center.x, z - cluster.center.z)).toBeLessThan(cluster.radius);
        let inside = false;
        for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
          const [ax, az] = BR_ISLAND_OUTLINE[i], [bx, bz] = BR_ISLAND_OUTLINE[j];
          if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
          expect(segmentDistance(x, z, { x: ax, z: az }, { x: bx, z: bz })).toBeGreaterThan(8);
        }
        expect(inside).toBe(true);
      }
    }
  });

  it("produces each contextual kit without introducing a solid shelter or cargo stack", () => {
    const inputs = { roads: [{ ...BR_ROADS[0], from: { x: -100, y: 0, z: 0 }, to: { x: 100, y: 0, z: 0 } }],
      structures: [], blocks: [], patches: [], traversal: [], reserved: [], outline: [[-250, -250], [250, -250], [250, 250], [-250, 250]] as const };
    for (const [style, theme] of [["dock", "cargo"], ["reactor", "service"], ["academy", "landscape"], ["city", "transit"]] as const) {
      const clusters = buildConnectiveClusters({ ...inputs, locations: [{ ...BR_POIS[0], style }] });
      expect(clusters).toHaveLength(1);
      expect(clusters[0].theme).toBe(theme);
      expect(clusters[0].parts.length).toBeLessThanOrEqual(14);
    }
    expect(buildConnectiveClusters({ ...inputs, locations: [] })).toEqual([]);
    expect(buildConnectiveClusters({ ...inputs, reserved: [{ position: { x: 0, y: 0, z: 0 }, radius: 1000 }] })).toEqual([]);
    expect(buildConnectiveClusters({ ...inputs, outline: [[0, 0], [1, 0], [0, 1]] })).toEqual([]);
    expect(buildConnectiveClusters({ ...inputs, roads: [{ ...BR_ROADS[0], width: NaN }] })).toEqual([]);
  });
});
