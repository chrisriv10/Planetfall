import { describe, expect, it } from "vitest";
import { BR_ISLAND_OUTLINE, BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES } from "@planetfall/shared";
import { buildRoadsideInfrastructure } from "./br-roadside-infrastructure";

const segmentDistance = (x: number, z: number, road: (typeof BR_ROADS)[number]) => {
  const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z;
  const t = Math.max(0, Math.min(1, ((x - road.from.x) * dx + (z - road.from.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - road.from.x - t * dx, z - road.from.z - t * dz);
};

describe("BR roadside infrastructure", () => {
  it("adds a deterministic sparse set with a bounded instance budget", () => {
    const sites = buildRoadsideInfrastructure();
    expect(sites.length).toBeGreaterThanOrEqual(12);
    expect(sites.length).toBeLessThanOrEqual(22);
    expect(buildRoadsideInfrastructure()).toEqual(sites);
    expect(new Set(sites.map(site => site.roadId)).size).toBe(sites.length);
    expect(sites.every(site => BR_SECONDARY_LOCATIONS.some(location => location.id === site.locationId))).toBe(true);
    expect(sites.reduce((count,site)=>count+site.parts.length,0)).toBeLessThanOrEqual(520);
    const planted = sites.filter(site => ["city", "mall", "academy", "nexus"].includes(site.style));
    expect(planted.length).toBeGreaterThanOrEqual(6);
    expect(planted.every(site => site.parts.some(part => part.geometry === "octahedron" && ["canopy", "energyCyan"].includes(part.finish)))).toBe(true);
    expect(planted.every(site => site.parts.filter(part => part.geometry === "octahedron").length >= 4)).toBe(true);
  });

  it("keeps whole sites away from roads, authored buildings and island edges", () => {
    for (const site of buildRoadsideInfrastructure()) {
      for (const road of BR_ROADS) {
        expect(segmentDistance(site.center.x, site.center.z, road)).toBeGreaterThanOrEqual(road.width / 2 + 6);
      }
      for (const structure of BR_STRUCTURES) {
        const dx = Math.max(0, Math.abs(site.center.x - structure.position.x) - structure.size.x / 2);
        const dz = Math.max(0, Math.abs(site.center.z - structure.position.z) - structure.size.z / 2);
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(8);
      }
      expect(site.parts.every(part => Number.isFinite(part.position.x) && Number.isFinite(part.position.y)
        && Number.isFinite(part.position.z) && Number.isFinite(part.rotationY))).toBe(true);
      expect(site.parts.every(part => part.surface ? part.scale.y <= .012 && part.position.y <= .055 : true)).toBe(true);
      expect(site.parts.filter(part => part.geometry === "box" && part.position.y > .4 && part.finish !== "structuralDark")
        .every(part => part.scale.x <= .58)).toBe(true);
      expect(site.parts.every(part => {
        const radius = part.geometry === "box" ? Math.hypot(part.scale.x, part.scale.z) / 2 : Math.max(part.scale.x, part.scale.z);
        // Long flush bay markings intentionally reach 40cm beyond the nominal
        // four-metre object radius while staying inside the tested six-metre
        // road/structure clearance envelope.
        return Math.hypot(part.position.x - site.center.x, part.position.z - site.center.z) + radius <= 4.45;
      })).toBe(true);
      expect(BR_ISLAND_OUTLINE.length).toBeGreaterThan(3);
    }
  });

  it("skips candidates when no safe roadside position exists", () => {
    expect(buildRoadsideInfrastructure({ outline: [[0, 0], [1, 0], [0, 1]] })).toEqual([]);
    expect(buildRoadsideInfrastructure({ locations: [] })).toEqual([]);
  });
});
