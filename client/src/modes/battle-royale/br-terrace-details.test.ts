import { describe, expect, it } from "vitest";
import { BR_TERRACES, type BrTerrace } from "@planetfall/shared";
import { BR_TERRACE_ACCESS_GAP, buildBrTerraceDetails } from "./br-terrace-details";

describe("BR terrace edge presentation", () => {
  it("is deterministic and bounded without mutating authored platforms", () => {
    const before = JSON.stringify(BR_TERRACES);
    expect(BR_TERRACES.length).toBeGreaterThan(0);
    for (const terrace of BR_TERRACES) {
      const parts = buildBrTerraceDetails(terrace);
      expect(parts).toHaveLength(26);
      expect(buildBrTerraceDetails(terrace)).toEqual(parts);
      expect(parts.filter(part => part.role === "fascia")).toHaveLength(5);
      expect(parts.filter(part => part.role === "rim")).toHaveLength(5);
      expect(parts.filter(part => part.geometry === "octahedron")).toHaveLength(6);
    }
    expect(JSON.stringify(BR_TERRACES)).toBe(before);
  });

  it("keeps all footprints on the true platform and ramp landing clear on every access side", () => {
    for (const base of BR_TERRACES) for (const accessSide of ["north", "south", "east", "west"] as const) {
      const terrace = { ...base, accessSide };
      const ns = accessSide === "north" || accessSide === "south";
      const halfDepth = (ns ? terrace.size.z : terrace.size.x) / 2;
      for (const part of buildBrTerraceDetails(terrace)) {
        expect([...Object.values(part.position), part.rotationY].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
        const factor = part.geometry === "box" ? .5 : 1;
        const dx = part.position.x - terrace.position.x, dz = part.position.z - terrace.position.z;
        const cos = Math.cos(part.rotationY), sin = Math.sin(part.rotationY);
        const localX = cos * dx - sin * dz, localZ = sin * dx + cos * dz;
        // The 6.4m opening extends four metres inward from the platform lip.
        expect(Math.abs(localX) - part.scale.x * factor >= BR_TERRACE_ACCESS_GAP / 2 - 1e-9
          || localZ + part.scale.z * factor <= halfDepth - 4).toBe(true);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = dx + cos * sx * part.scale.x * factor + sin * sz * part.scale.z * factor;
          const z = dz - sin * sx * part.scale.x * factor + cos * sz * part.scale.z * factor;
          expect(Math.abs(x)).toBeLessThanOrEqual(terrace.size.x / 2 + 1e-9);
          expect(Math.abs(z)).toBeLessThanOrEqual(terrace.size.z / 2 + 1e-9);
        }
        if (part.role === "fascia") {
          expect(part.position.y + part.scale.y / 2).toBeLessThan(terrace.height);
          // Visible face reaches the real skin instead of being buried.
          const halfWidth = (ns ? terrace.size.x : terrace.size.z) / 2;
          expect(Math.min(Math.abs(Math.abs(localX) + part.scale.x / 2 - halfWidth),
            Math.abs(Math.abs(localZ) + part.scale.z / 2 - halfDepth))).toBeLessThan(1e-9);
        }
        if (part.role === "rim") expect(part.position.y + part.scale.y / 2 - terrace.height).toBeLessThan(.06);
        if (part.role === "planter") expect(part.position.y + part.scale.y * factor - terrace.height).toBeLessThanOrEqual(.53 + 1e-9);
        if (part.role === "light") {
          expect(part.scale.x).toBeLessThanOrEqual(.16); expect(part.scale.z).toBeLessThanOrEqual(.16);
          expect(part.position.y + part.scale.y / 2 - terrace.height).toBeLessThanOrEqual(1.55 + 1e-9);
        }
      }
    }
  });

  it("uses restrained district identity and rejects malformed or undersized supports", () => {
    const base = BR_TERRACES[0];
    for (const [districtId, finish] of [["astra-academy", "energyPurple"], ["crash-site", "warningRed"], ["orbital-farms", "energyCyan"]] as const) {
      const parts = buildBrTerraceDetails({ ...base, districtId });
      expect(parts.filter(part => part.role === "light" && part.finish !== "brushedMetal").every(part => part.finish === finish)).toBe(true);
    }
    for (const terrace of [
      { ...base, height: NaN }, { ...base, height: .2 },
      { ...base, size: { x: 4, z: 14 } }, { ...base, position: { x: Infinity, y: 0, z: 0 } },
      { ...base, accessSide: "bad" } as unknown as BrTerrace
    ]) expect(buildBrTerraceDetails(terrace)).toEqual([]);
  });
});
