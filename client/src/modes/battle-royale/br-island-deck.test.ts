import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE } from "@planetfall/shared";
import { buildBrIslandDeckGeometry } from "./br-island-deck";

describe("island deck skin", () => {
  it("covers exactly the island polygon with upward-facing triangles and no tile overhang", () => {
    const geometry = buildBrIslandDeckGeometry();
    const positions = geometry.getAttribute("position");
    const indices = geometry.getIndex()!;
    let triangleArea = 0;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex), z = positions.getZ(vertex);
      expect(BR_ISLAND_OUTLINE.some(([px, pz]) => x === px && z === pz)).toBe(true);
      expect(positions.getY(vertex)).toBeCloseTo(.006, 7);
      // The authored outline is convex: every vertex must be on or inside
      // every edge, including the diagonals formerly crossed by square tiles.
      for (let edge = 0; edge < BR_ISLAND_OUTLINE.length; edge++) {
        const [ax, az] = BR_ISLAND_OUTLINE[edge];
        const [bx, bz] = BR_ISLAND_OUTLINE[(edge + 1) % BR_ISLAND_OUTLINE.length];
        expect((bx - ax) * (z - az) - (bz - az) * (x - ax)).toBeGreaterThanOrEqual(0);
      }
    }
    for (let index = 0; index < indices.count; index += 3) {
      const a = indices.getX(index), b = indices.getX(index + 1), c = indices.getX(index + 2);
      const upwardCross = (positions.getZ(b) - positions.getZ(a)) * (positions.getX(c) - positions.getX(a))
        - (positions.getX(b) - positions.getX(a)) * (positions.getZ(c) - positions.getZ(a));
      expect(upwardCross).toBeGreaterThan(0);
      triangleArea += upwardCross / 2;
    }
    const polygonArea = BR_ISLAND_OUTLINE.reduce((sum, [x, z], index) => {
      const [nx, nz] = BR_ISLAND_OUTLINE[(index + 1) % BR_ISLAND_OUTLINE.length];
      return sum + (x * nz - nx * z) / 2;
    }, 0);
    expect(triangleArea).toBeCloseTo(polygonArea, 5);
    expect(indices.count / 3).toBe(BR_ISLAND_OUTLINE.length - 2);
    geometry.dispose();
  });

  it("retains world-aligned 44m UV pitch for the existing repeating panel texture", () => {
    const geometry = buildBrIslandDeckGeometry();
    const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    for (let index = 0; index < positions.count; index++) {
      expect(uv.getX(index) * 44 - 460).toBeCloseTo(positions.getX(index), 3);
      expect(-uv.getY(index) * 44 - 452).toBeCloseTo(positions.getZ(index), 3);
      expect(geometry.getAttribute("normal").getY(index)).toBeCloseTo(1);
    }
    geometry.dispose();
  });
});
