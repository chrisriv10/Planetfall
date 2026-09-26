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
    const inputsBefore = JSON.stringify([BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES]);
    const sites = buildRoadsideInfrastructure();
    expect(sites.length).toBeGreaterThanOrEqual(12);
    expect(sites.length).toBeLessThanOrEqual(22);
    expect(buildRoadsideInfrastructure()).toEqual(sites);
    expect(JSON.stringify([BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES])).toBe(inputsBefore);
    expect(new Set(sites.map(site => site.roadId)).size).toBe(sites.length);
    expect(sites.every(site => BR_SECONDARY_LOCATIONS.some(location => location.id === site.locationId))).toBe(true);
    // Seven open-frame pieces plus four low furniture pieces per existing
    // pocket; no new sites/material families. Worst case: 22 transit kits.
    expect(sites.every(site => site.parts.length >= 26 && site.parts.length <= 31)).toBe(true);
    expect(sites.reduce((count,site)=>count+site.parts.length,0)).toBeLessThanOrEqual(682);
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
      expect(site.parts.every(part => [part.scale.x, part.scale.y, part.scale.z].every(value => Number.isFinite(value) && value > 0))).toBe(true);
      expect(site.parts.every(part => part.surface ? part.scale.y <= .012 && part.position.y <= .055 : true)).toBe(true);
      // Broad horizontal pieces are permitted only for low seats or open
      // overhead blades; eye-level opaque boxes cannot become false walls.
      expect(site.parts.filter(part => part.geometry === "box" && !part.surface && part.scale.x > .58)
        .every(part => part.scale.y <= .14 && (part.position.y <= .5 || part.position.y - part.scale.y / 2 >= 2.7))).toBe(true);
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

  it("adds an open frame and low district-appropriate furnishing to every pocket", () => {
    for (const site of buildRoadsideInfrastructure()) {
      const posts = site.parts.filter(part => part.finish === "structuralDark" && part.scale.y === 2.8);
      expect(posts).toHaveLength(2);
      expect(posts.every(part => part.scale.x === .12 && part.scale.z === .12)).toBe(true);
      const blades = site.parts.filter(part => part.finish === "brushedMetal" && part.position.y === 2.92);
      expect(blades).toHaveLength(3);
      expect(blades.every(part => part.scale.x === .72 && part.scale.z === 1.25)).toBe(true);
      // Local-frame gaps are invariant under world rotation: 1.1m centers,
      // .72m blades, leaving .38m of open sky between each pair.
      for (let i = 1; i < blades.length; i++) {
        expect(Math.hypot(blades[i].position.x - blades[i - 1].position.x,
          blades[i].position.z - blades[i - 1].position.z) - .72).toBeCloseTo(.38);
      }
      const transit = ["city", "mall", "academy", "nexus"].includes(site.style);
      if (transit) {
        expect(site.parts.filter(part => part.finish === "brushedMetal" && part.position.y === .5)).toHaveLength(2);
      } else {
        expect(site.parts.filter(part => part.finish === "windowLit" && part.position.y === .889)).toHaveLength(1);
      }
      const accent = site.style === "wreck" ? "warningRed" : site.style === "farm" ? "grass"
        : ["city", "mall", "academy"].includes(site.style) ? "energyPurple"
        : site.style === "nexus" ? "energyCyan" : "industrialOrange";
      expect(site.parts.some(part => part.position.y === 2.81 && part.finish === accent)).toBe(true);
    }
  });

  it("skips candidates when no safe roadside position exists", () => {
    expect(buildRoadsideInfrastructure({ outline: [[0, 0], [1, 0], [0, 1]] })).toEqual([]);
    expect(buildRoadsideInfrastructure({ locations: [] })).toEqual([]);
  });
});
