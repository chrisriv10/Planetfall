import { describe, expect, it } from "vitest";
import { BR_STRUCTURES } from "@planetfall/shared";
import { buildReactorInterior } from "./br-reactor-interior";

describe("Helios reactor interior dressing", () => {
  const core = BR_STRUCTURES.find(structure => structure.id === "helios-core")!;

  it("only dresses the enterable Helios Core", () => {
    expect(BR_STRUCTURES.filter(structure => buildReactorInterior(structure).length).map(structure => structure.id)).toEqual(["helios-core"]);
    expect(buildReactorInterior({ ...core, enterable: false })).toEqual([]);
    expect(buildReactorInterior({ ...core, districtId: "zero-point" })).toEqual([]);
  });

  it("keeps the central authoritative doorway clear", () => {
    for (const part of buildReactorInterior(core)) {
      const innerEdge = Math.abs(part.position.x - core.position.x) - part.scale.x / 2;
      expect(innerEdge).toBeGreaterThanOrEqual(2.5);
      const wallFace = core.position.z + core.size.z * .18 - .29;
      expect(part.position.z).toBeLessThan(wallFace);
      expect(part.position.z).toBeGreaterThanOrEqual(wallFace - .14);
    }
  });

  it("uses finite, shallow wall-mounted pieces with a bounded budget", () => {
    const parts = buildReactorInterior(core);
    expect(parts.length).toBeGreaterThan(20);
    expect(parts.length).toBeLessThanOrEqual(48);
    for (const part of parts) {
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect(part.scale.z).toBeLessThanOrEqual(.18);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThan(1.2);
    }
  });
});
