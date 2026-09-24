import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE } from "@planetfall/shared";
import { BR_PERIMETER_SHELL_CLEARANCE, buildPerimeterArmor } from "./br-perimeter-armor";

describe("orbital island perimeter armor", () => {
  it("is deterministic, globally batched and bounded without changing the outline", () => {
    const before = JSON.stringify(BR_ISLAND_OUTLINE);
    const batches = buildPerimeterArmor();
    expect(buildPerimeterArmor()).toEqual(batches);
    expect(batches).toHaveLength(4);
    const parts = batches.flatMap(batch => batch.parts);
    expect(parts.length).toBeGreaterThan(150);
    expect(parts.length).toBeLessThanOrEqual(328);
    expect(batches.find(batch => batch.finish === "energyCyan")!.parts.length).toBeLessThanOrEqual(24);
    expect(new Set(parts.map(part => part.segmentIndex)).size).toBe(BR_ISLAND_OUTLINE.length);
    expect(JSON.stringify(BR_ISLAND_OUTLINE)).toBe(before);
  });

  it("clears the rendered shell bevel with every rotated corner for either winding", () => {
    expect(BR_PERIMETER_SHELL_CLEARANCE).toBeGreaterThanOrEqual(4.6 + .2);
    const acuteOutline = [[0, 0], [160, 10], [30, 80]] as const;
    for (const outline of [BR_ISLAND_OUTLINE, [...BR_ISLAND_OUTLINE].reverse(), acuteOutline, [...acuteOutline].reverse()]) {
      const area = outline.reduce((sum, [x, z], index) => {
        const [nx, nz] = outline[(index + 1) % outline.length];
        return sum + x * nz - nx * z;
      }, 0);
      for (const batch of buildPerimeterArmor(outline)) for (const part of batch.parts) {
        const [ax, az] = outline[part.segmentIndex], [bx, bz] = outline[(part.segmentIndex + 1) % outline.length];
        const length = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / length, tz = (bz - az) / length;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = part.position.x + Math.cos(part.rotationY) * sx * part.scale.x / 2 + Math.sin(part.rotationY) * sz * part.scale.z / 2;
          const z = part.position.z - Math.sin(part.rotationY) * sx * part.scale.x / 2 + Math.cos(part.rotationY) * sz * part.scale.z / 2;
          const outward = Math.sign(area) * (tz * (x - ax) - tx * (z - az));
          const along = tx * (x - ax) + tz * (z - az);
          expect(outward).toBeGreaterThan(BR_PERIMETER_SHELL_CLEARANCE);
          // Literal regression threshold guards against weakening the contract
          // while the renderer still extrudes a 4.6m bevel.
          expect(outward).toBeGreaterThan(4.8);
          expect(along).toBeGreaterThan(.7);
          expect(along).toBeLessThan(length - .7);
          // Independent polygon containment check: no corner is on the deck.
          let inside = false;
          for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
            const [ix, iz] = outline[i], [jx, jz] = outline[j];
            if ((iz > z) !== (jz > z) && x < (jx - ix) * (z - iz) / (jz - iz) + ix) inside = !inside;
          }
          expect(inside).toBe(false);
        }
      }
    }
  });

  it("mounts sparse readable lenses just beyond lower armor faces", () => {
    const batches = buildPerimeterArmor();
    const lenses = batches.find(batch => batch.finish === "energyCyan")!.parts;
    const plates = batches.find(batch => batch.finish === "brushedMetal")!.parts.filter(part => part.position.y === -12.2);
    expect(lenses.length).toBeGreaterThan(0);
    expect(lenses.length).toBeLessThanOrEqual(24);
    for (const lens of lenses) {
      const plate = plates.find(part => part.segmentIndex === lens.segmentIndex
        && Math.abs((lens.position.x - part.position.x) * Math.cos(lens.rotationY)
          - (lens.position.z - part.position.z) * Math.sin(lens.rotationY)) < 1e-6)!;
      expect(plate).toBeDefined();
      const normalDistance = Math.hypot(lens.position.x - plate.position.x, lens.position.z - plate.position.z);
      expect(normalDistance - lens.scale.z / 2 - plate.scale.z / 2).toBeCloseTo(.005);
      expect(lens.scale.x).toBeGreaterThanOrEqual(2);
      expect(lens.scale.y).toBeGreaterThanOrEqual(.3);
      expect(lens.scale.x).toBeLessThan(plate.scale.x);
    }
  });

  it("has finite positive transforms and cannot create deck-top cover or surfaces", () => {
    for (const batch of buildPerimeterArmor()) for (const part of batch.parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(n => Number.isFinite(n) && n > 0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
      expect(part.position.y + part.scale.y / 2).toBeLessThan(-1);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThanOrEqual(-30);
      expect(part.scale.z).toBeLessThanOrEqual(2.8);
    }
    const huge = [[-100000, -100000], [100000, -100000], [100000, 100000], [-100000, 100000]] as const;
    expect(buildPerimeterArmor(huge).flatMap(batch => batch.parts).length).toBeLessThanOrEqual(328);
  });

  it("refuses degenerate, non-finite, concave or excessive outlines", () => {
    expect(buildPerimeterArmor([])).toEqual([]);
    expect(buildPerimeterArmor([[0, 0], [10, 0], [20, 0]])).toEqual([]);
    expect(buildPerimeterArmor([[0, 0], [NaN, 20], [20, 0]])).toEqual([]);
    expect(buildPerimeterArmor([[0, 0], [30, 0], [15, 15], [30, 30], [0, 30]])).toEqual([]);
    expect(buildPerimeterArmor([[0, 0], [0, 0], [30, 30], [0, 30]])).toEqual([]);
    expect(buildPerimeterArmor(Array.from({ length: 65 }, (_, i) => [Math.cos(i) * 100, Math.sin(i) * 100] as const))).toEqual([]);
  });
});
