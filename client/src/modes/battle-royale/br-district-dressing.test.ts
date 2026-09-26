import { describe, expect, it } from "vitest";
import type { BrDistrictPlan } from "@planetfall/shared";
import { buildBrDistrictDressing } from "./br-district-dressing";

const plan: BrDistrictPlan = {
  id: "review-court", origin: { x: 100, y: 0, z: 120 }, elevation: 3,
  kind: "neighborhood", approach: { x: .6, y: 0, z: .8 }, streets: [], parcels: [],
  openZone: { position: { x: 110, y: 3, z: 130 }, radius: 12, purpose: "courtyard" }
};
const options = { quality: "high" as const, isClear: () => true };

describe("authored district courtyard presentation", () => {
  it("keeps every complete cluster inside its reserved clearance circle and the open zone", () => {
    const clusters = buildBrDistrictDressing(plan, options);
    expect(clusters).toHaveLength(4);
    for (const cluster of clusters) {
      expect(Math.hypot(cluster.center.x - plan.openZone.position.x, cluster.center.z - plan.openZone.position.z) + cluster.radius).toBeLessThanOrEqual(plan.openZone.radius);
      for (const part of cluster.parts) {
        const radial = part.geometry === "cylinder" || part.geometry === "octahedron";
        const half = radial ? 1 : .5;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = part.position.x + sx * part.scale.x * half * Math.cos(part.rotationY) + sz * part.scale.z * half * Math.sin(part.rotationY);
          const z = part.position.z - sx * part.scale.x * half * Math.sin(part.rotationY) + sz * part.scale.z * half * Math.cos(part.rotationY);
          expect(Math.hypot(x - cluster.center.x, z - cluster.center.z)).toBeLessThanOrEqual(cluster.radius);
        }
        const halfY = part.geometry === "octahedron" ? 1 : .5;
        expect(part.position.y - part.scale.y * halfY).toBeGreaterThanOrEqual(plan.elevation);
      }
      // The approach is (.6,.8), so its right normal is (-.8,.6).
      const lateral = -.8 * (cluster.center.x - plan.openZone.position.x) + .6 * (cluster.center.z - plan.openZone.position.z);
      expect(Math.abs(lateral) - cluster.radius).toBeGreaterThanOrEqual(2.5);
    }
  });

  it("gives all seven site families distinct bounded compositions", () => {
    const kinds: BrDistrictPlan["kind"][] = ["neighborhood", "campus", "commercial", "workyard", "agricultural", "salvage", "civic"];
    const signatures = new Set<string>();
    for (const kind of kinds) {
      const site = { ...plan, kind };
      const result = buildBrDistrictDressing(site, options);
      expect(result).toEqual(buildBrDistrictDressing(site, options));
      expect(result.flatMap(group => group.parts).length).toBeLessThanOrEqual(100);
      signatures.add(JSON.stringify(result[0].parts.map(part => [part.geometry, part.finish, part.scale])));
    }
    expect(signatures.size).toBe(7);
  });

  it("retains paired focal groups on low and reduces decoration without moving surviving groups", () => {
    const high = buildBrDistrictDressing(plan, options);
    const medium = buildBrDistrictDressing(plan, { ...options, quality: "medium" });
    const low = buildBrDistrictDressing(plan, { ...options, quality: "low" });
    expect(low).toHaveLength(2);
    expect(medium).toHaveLength(4);
    expect(medium.flatMap(group => group.parts).length).toBeLessThan(high.flatMap(group => group.parts).length);
    for (const cluster of low) expect(cluster.center).toEqual(high.find(group => group.id === cluster.id)?.center);
  });

  it("honors world clearance for whole groups, including their actual extent", () => {
    const considered: number[] = [];
    const allowed = buildBrDistrictDressing(plan, { ...options, isClear: (center, radius) => {
      considered.push(radius);
      return center.x > plan.openZone.position.x;
    } });
    expect(considered).toHaveLength(4);
    expect(considered.every(radius => radius === 2.25)).toBe(true);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.every(group => group.center.x > plan.openZone.position.x)).toBe(true);
    expect(buildBrDistrictDressing(plan, { ...options, isClear: () => false })).toEqual([]);
    expect(buildBrDistrictDressing({ ...plan, approach: { x: 0, y: 0, z: 0 } }, options)).toEqual([]);
  });
});
