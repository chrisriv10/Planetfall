import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildMallCeilingEdges } from "./br-mall-ceiling-edges";

const malls = BR_STRUCTURES.filter(s => ["void-anchor", "void-food-court"].includes(s.id));

describe("mall supported ceiling-edge architecture", () => {
  it("adds a bounded, deterministic open frame at both authored levels", () => {
    const before = JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS]);
    expect(BR_STRUCTURES.filter(s => buildMallCeilingEdges(s).length).map(s => s.id).sort()).toEqual(["void-anchor", "void-food-court"]);
    for (const structure of malls) {
      const edges = buildMallCeilingEdges(structure);
      expect(edges).toHaveLength(2);
      expect(buildMallCeilingEdges(structure)).toEqual(edges);
      expect(buildMallCeilingEdges(structure, [...BR_MAP_BLOCKS].reverse())).toEqual(edges);
      for (const edge of edges) {
        expect(edge.parts.length).toBeGreaterThan(5);
        expect(edge.parts.length).toBeLessThanOrEqual(18);
        // Sparse trim occupies little ceiling area; there is no filled roof.
        expect(edge.parts.reduce((sum, p) => sum + p.scale.x * p.scale.z, 0)).toBeLessThan(8);
      }
    }
    expect(JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS])).toBe(before);
  });

  it("attaches finite boxes to actual slab undersides with full footprint support", () => {
    for (const structure of malls) for (const edge of buildMallCeilingEdges(structure)) {
      const slab = BR_MAP_BLOCKS.find(b => b.id === edge.slabId)!;
      const ceiling = slab.position.y - slab.size.y / 2;
      for (const part of edge.parts) {
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(v => Number.isFinite(v) && v > 0)).toBe(true);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(ceiling);
        expect(part.position.y - part.scale.y / 2).toBeGreaterThan(ceiling - .06);
        expect(Math.abs(part.position.x - slab.position.x) + part.scale.x / 2 + .4).toBeLessThan(slab.size.x / 2);
        expect(Math.abs(part.position.z - slab.position.z) + part.scale.z / 2 + .4).toBeLessThan(slab.size.z / 2);
        expect(BR_MAP_BLOCKS.some(block => block.id.startsWith(`${structure.id}-`) && block.kind === "platform"
          && block.position.y < slab.position.y - .5
          && Math.abs(part.position.x - block.position.x) + part.scale.x / 2 < block.size.x / 2
          && Math.abs(part.position.z - block.position.z) + part.scale.z / 2 < block.size.z / 2
          && part.position.y - part.scale.y / 2 - block.position.y - block.size.y / 2 >= 3.2)).toBe(true);
      }
    }
  });

  it("keeps the center, stairs, loot and partition tops clear", () => {
    for (const structure of malls) for (const edge of buildMallCeilingEdges(structure)) for (const part of edge.parts) {
      expect(part.position.x + part.scale.x / 2).toBeLessThan(structure.position.x - structure.size.x / 2 + 2.6);
      for (const stair of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-stairs-`)))
        expect(part.position.x + part.scale.x / 2 + 1).toBeLessThan(stair.position.x - stair.size.x / 2);
      for (const wall of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-`) && b.kind === "wall")) {
        const intersects = Math.abs(part.position.x - wall.position.x) < (part.scale.x + wall.size.x) / 2
          && Math.abs(part.position.y - wall.position.y) < (part.scale.y + wall.size.y) / 2
          && Math.abs(part.position.z - wall.position.z) < (part.scale.z + wall.size.z) / 2;
        expect(intersects).toBe(false);
      }
      for (const loot of BR_LOOT_SOCKETS.filter(s => s.structureId === structure.id))
        expect(Math.abs(part.position.x - loot.position.x)).toBeGreaterThan(part.scale.x / 2 + .6);
    }
  });

  it("omits incomplete, low, tilted or malformed supporting geometry", () => {
    const anchor = malls[0];
    expect(buildMallCeilingEdges({ ...anchor, enterable: false })).toEqual([]);
    expect(buildMallCeilingEdges(anchor, [])).toEqual([]);
    expect(buildMallCeilingEdges(anchor, BR_MAP_BLOCKS.filter(b => b.kind !== "platform"))).toEqual([]);
    const low = BR_MAP_BLOCKS.map(b => b.id.startsWith(`${anchor.id}-`) && b.kind === "platform"
      ? { ...b, position: { ...b.position, y: b.position.y / 10 } } : b);
    expect(buildMallCeilingEdges(anchor, low)).toEqual([]);
    const malformed = BR_MAP_BLOCKS.map(b => b.id.startsWith(`${anchor.id}-`) && b.kind === "platform"
      ? { ...b, size: { ...b.size, x: NaN } } : b);
    expect(buildMallCeilingEdges(anchor, malformed)).toEqual([]);
    const tilted = BR_MAP_BLOCKS.map(b => b.id.startsWith(`${anchor.id}-`) && b.kind === "platform"
      ? { ...b, rotation: { x: .2, y: 0, z: 0 } } : b);
    expect(buildMallCeilingEdges(anchor, tilted)).toEqual([]);
  });
});
