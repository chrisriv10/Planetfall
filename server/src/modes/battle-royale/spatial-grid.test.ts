import { describe, expect, it } from "vitest";
import { SpatialGrid } from "./spatial-grid.js";

describe("Battle Royale spatial grid", () => {
  it("indexes the planar island without losing three-dimensional distance filtering", () => {
    const grid = new SpatialGrid<{ id: string; position: { x: number; y: number; z: number } }>(20);
    grid.rebuild([
      { id: "near", position: { x: 19, y: 1, z: 0 } },
      { id: "across-cell", position: { x: 21, y: 1, z: 0 } },
      { id: "above", position: { x: 4, y: 100, z: 4 } },
      { id: "far", position: { x: 80, y: 0, z: 0 } }
    ]);

    expect(grid.nearby({ x: 20, y: 0, z: 0 }, 4).map((entry) => entry.id).sort()).toEqual(["across-cell", "near"]);
    expect(grid.nearby({ x: 4, y: 0, z: 4 }, 20).map((entry) => entry.id)).not.toContain("above");
  });
});
