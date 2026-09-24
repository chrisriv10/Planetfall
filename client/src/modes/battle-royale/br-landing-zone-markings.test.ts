import { describe, expect, it } from "vitest";
import { BR_TERRAIN_PATCHES } from "@planetfall/shared";
import { buildBrLandingZoneMarkings } from "./br-landing-zone-markings";

describe("BR authored landing-zone markings", () => {
  it("covers exactly the authored landing patches deterministically without changing them", () => {
    const before = JSON.stringify(BR_TERRAIN_PATCHES);
    const parts = buildBrLandingZoneMarkings();
    expect(parts.length).toBeGreaterThanOrEqual(30);
    expect(parts.length).toBeLessThanOrEqual(50);
    expect(buildBrLandingZoneMarkings()).toEqual(parts);
    expect(buildBrLandingZoneMarkings([...BR_TERRAIN_PATCHES].reverse())).toEqual(parts);
    expect(JSON.stringify(BR_TERRAIN_PATCHES)).toBe(before);
    expect(new Set(parts.map(part => part.finish))).toEqual(new Set(["brushedMetal", "sidewalk", "warningRed", "industrialOrange"]));
  });

  it("keeps every finite flush part within one real landing patch", () => {
    for (const part of buildBrLandingZoneMarkings()) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect(Number.isFinite(part.rotationY)).toBe(true);
      expect(part.position.y + part.scale.y / 2).toBeLessThan(.03);
      const supportingPatch = BR_TERRAIN_PATCHES.filter(patch => patch.kind === "landing").find(patch => {
        const dx = part.position.x - patch.position.x, dz = part.position.z - patch.position.z;
        const localX = dx * Math.cos(patch.rotation) - dz * Math.sin(patch.rotation);
        const localZ = dx * Math.sin(patch.rotation) + dz * Math.cos(patch.rotation);
        return Math.abs(localX) + part.scale.x / 2 <= patch.size.x / 2
          && Math.abs(localZ) + part.scale.z / 2 <= patch.size.z / 2;
      });
      expect(supportingPatch).toBeDefined();
    }
  });

  it("rejects malformed or undersized patches instead of drawing outside them", () => {
    const source = BR_TERRAIN_PATCHES.find(patch => patch.kind === "landing")!;
    expect(buildBrLandingZoneMarkings([{ ...source, size: { x: 20, y: .1, z: 20 } }])).toEqual([]);
    expect(buildBrLandingZoneMarkings([{ ...source, rotation: NaN }])).toEqual([]);
    expect(buildBrLandingZoneMarkings([{ ...source, kind: "plaza" }])).toEqual([]);
  });
});
