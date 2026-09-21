import { describe, expect, it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildNovaEntrancePaving } from "./br-entrance-paving";

const shops = BR_STRUCTURES.filter(s => ["nova-cafe", "nova-arcade", "nova-market"].includes(s.id));

describe("Nova shop approach paving", () => {
  it("limits pedestrian paving to the three open Nova shops", () => {
    expect(BR_STRUCTURES.filter(s => buildNovaEntrancePaving(s).length).map(s => s.id).sort())
      .toEqual(["nova-arcade", "nova-cafe", "nova-market"]);
    expect(buildNovaEntrancePaving({ ...shops[0], enterable: false })).toEqual([]);
    expect(buildNovaEntrancePaving({ ...shops[0], districtId: "void-mall" })).toEqual([]);
    expect(buildNovaEntrancePaving({ ...shops[0], size: { x: 5, y: 6, z: 5 } })).toEqual([]);
  });

  it("centers each approach outside its real door for all four orientations", () => {
    for (const shop of shops) for (const entrance of ["north", "south", "east", "west"] as const) {
      const structure = { ...shop, entrance };
      const lateral = entrance === "north" || entrance === "south" ? "x" : "z";
      const normal = lateral === "x" ? "z" : "x";
      const outward = entrance === "north" || entrance === "east" ? 1 : -1;
      for (const part of buildNovaEntrancePaving(structure)) {
        const outerEdge = Math.abs(part.position[lateral] - structure.position[lateral]) + part.scale[lateral] / 2;
        expect(outerEdge).toBeLessThan(2.4);
        const fromWall = outward * (part.position[normal] - structure.position[normal]) - structure.size[normal] / 2;
        expect(fromWall - part.scale[normal] / 2).toBeGreaterThan(.75);
        expect(fromWall + part.scale[normal] / 2).toBeLessThan(3.4);
      }
    }
  });

  it("stays a sparse surface treatment, without overlapping tiles or raised cover", () => {
    for (const shop of shops) {
      const parts = buildNovaEntrancePaving(shop);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.length).toBeLessThanOrEqual(18);
      for (const [index, part] of parts.entries()) {
        expect(part.position.y - part.scale.y / 2).toBeGreaterThan(.03);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(.08);
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
        for (const other of parts.slice(index + 1)) {
          const separatedX = Math.abs(part.position.x - other.position.x) > (part.scale.x + other.scale.x) / 2;
          const separatedZ = Math.abs(part.position.z - other.position.z) > (part.scale.z + other.scale.z) / 2;
          expect(separatedX || separatedZ).toBe(true);
        }
      }
    }
  });
});
