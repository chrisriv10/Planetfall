import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import { buildNovaStorefrontParts } from "./br-storefronts";

const shops = BR_STRUCTURES.filter(s => ["nova-cafe", "nova-arcade", "nova-market"].includes(s.id));

describe("Nova storefront wall details", () => {
  it("dresses only the three named, open Nova shops", () => {
    expect(BR_STRUCTURES.filter(s => buildNovaStorefrontParts(s).length).map(s => s.id).sort())
      .toEqual(["nova-arcade", "nova-cafe", "nova-market"]);
    expect(buildNovaStorefrontParts({ ...shops[0], enterable: false })).toEqual([]);
    expect(buildNovaStorefrontParts({ ...shops[0], districtId: "void-mall" })).toEqual([]);
  });

  it("keeps the complete entrance slit clear for every wall orientation", () => {
    for (const shop of shops) for (const entrance of ["north", "south", "east", "west"] as const) {
      const structure: BrStructure = { ...shop, entrance };
      const lateral = entrance === "north" || entrance === "south" ? "x" : "z";
      const normal = lateral === "x" ? "z" : "x";
      const sign = entrance === "north" || entrance === "east" ? 1 : -1;
      for (const part of buildNovaStorefrontParts(structure)) {
        expect(part.face).toBe(entrance);
        expect(Math.abs(part.position[lateral] - structure.position[lateral]) - part.scale[lateral] / 2)
          .toBeGreaterThan(2.4);
        expect(Math.abs(part.position[lateral] - structure.position[lateral]) + part.scale[lateral] / 2)
          .toBeLessThan(structure.size[lateral] / 2);
        const fromWall = sign * (part.position[normal] - structure.position[normal]) - structure.size[normal] / 2;
        expect(fromWall - part.scale[normal] / 2).toBeGreaterThan(.325);
        expect(fromWall + part.scale[normal] / 2).toBeLessThan(1.1);
      }
    }
  });

  it("keeps the wall kit compact, above ground, and below the shop awning", () => {
    for (const shop of shops) {
      const parts = buildNovaStorefrontParts(shop);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.length).toBeLessThanOrEqual(20);
      for (const part of parts) {
        expect(part.position.y - part.scale.y / 2).toBeGreaterThan(1.4);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(3.8);
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      }
    }
  });

  it("omits details if a reused storefront cannot fit the kit", () => {
    expect(buildNovaStorefrontParts({ ...shops[0], size: { x: 10, y: 6, z: 10 } })).toEqual([]);
    expect(buildNovaStorefrontParts({ ...shops[0], size: { ...shops[0].size, y: 3 } })).toEqual([]);
  });
});
