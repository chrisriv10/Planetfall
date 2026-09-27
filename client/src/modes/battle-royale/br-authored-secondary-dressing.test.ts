import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP_BLOCKS,
  BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TRAVERSAL,
} from "@planetfall/shared";
import {
  buildBrAuthoredSecondaryDressing, buildBrAuthoredTransitionDressing,
  type BrAuthoredSecondaryDressing,
} from "./br-authored-secondary-dressing";

const groups = (): BrAuthoredSecondaryDressing[] => [
  ...BR_SECONDARY_LOCATIONS.map(site => buildBrAuthoredSecondaryDressing(site)!),
  ...buildBrAuthoredTransitionDressing(),
];
const segmentDistance = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / squared)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
const rectangleDistance = (p: { x: number; z: number }, c: { x: number; z: number }, w: number, d: number) =>
  Math.hypot(Math.max(0, Math.abs(p.x - c.x) - w / 2), Math.max(0, Math.abs(p.z - c.z) - d / 2));

describe("literal secondary-site presentation", () => {
  it("covers all 30 sites, all seven contexts and four exact route gaps with 272 fixed parts", () => {
    const before = JSON.stringify([BR_SECONDARY_LOCATIONS, BR_DISTRICT_PLANS, BR_MAP_BLOCKS]);
    const all = groups();
    expect(BR_SECONDARY_LOCATIONS).toHaveLength(30);
    expect(all).toHaveLength(34);
    expect(new Set(all.map(group => group.id)).size).toBe(34);
    expect(new Set(all.map(group => group.family)).size).toBe(7);
    expect(all.flatMap(group => group.parts)).toHaveLength(272);
    for (const site of BR_SECONDARY_LOCATIONS) {
      const first = buildBrAuthoredSecondaryDressing(site)!;
      expect(first.family).toBe(BR_DISTRICT_PLANS.find(plan => plan.id === site.id)?.kind);
      expect(first.context.length).toBeGreaterThan(20);
      expect(first.parts).toHaveLength(8);
      expect(new Set(first.parts.map(part => part.name)).size).toBe(8);
      const movedInput = { ...site, position: { x: 999, y: 99, z: -999 } };
      expect(buildBrAuthoredSecondaryDressing(movedInput)).toEqual(first);
      first.parts[0].position.x += 100;
      first.center.x += 100;
      expect(buildBrAuthoredSecondaryDressing(site)).not.toEqual(first);
    }
    expect(buildBrAuthoredSecondaryDressing({ id: "unmapped" })).toBeUndefined();
    expect(BR_SECONDARY_LOCATIONS.slice().reverse().map(site => buildBrAuthoredSecondaryDressing(site)).reverse())
      .toEqual(BR_SECONDARY_LOCATIONS.map(site => buildBrAuthoredSecondaryDressing(site)));
    expect(buildBrAuthoredTransitionDressing().map(group => [group.center.x, group.center.z]))
      .toEqual([[-25, 125], [25, -175], [-200, -275], [175, -25]]);
    expect(groups()).toEqual(all);
    expect(JSON.stringify([BR_SECONDARY_LOCATIONS, BR_DISTRICT_PLANS, BR_MAP_BLOCKS])).toBe(before);
    const source = readFileSync(new URL("./br-authored-secondary-dressing.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Math\.(random|sin|cos)|seededRandom|hashSeed|for\s*\(/);
  });

  it("keeps whole pocket circles clear of roads, buildings, entrances, gameplay blocks, open zones, loot and traversal", () => {
    for (const group of groups()) {
      const p = group.center, radius = group.radius;
      for (const road of BR_ROADS) expect(segmentDistance(p, road.from, road.to), `${group.id}: road ${road.id}`)
        .toBeGreaterThanOrEqual(road.width / 2 + radius + 2);
      for (const structure of BR_STRUCTURES) {
        expect(rectangleDistance(p, structure.position, structure.size.x, structure.size.z), `${group.id}: building ${structure.id}`)
          .toBeGreaterThanOrEqual(radius + 3);
        if (!structure.enterable) continue;
        const ns = structure.entrance === "north" || structure.entrance === "south";
        const sign = structure.entrance === "north" || structure.entrance === "east" ? 1 : -1;
        const doorway = { x: structure.position.x + (ns ? 0 : sign * (structure.size.x / 2 + 3)),
          z: structure.position.z + (ns ? sign * (structure.size.z / 2 + 3) : 0) };
        expect(rectangleDistance(p, doorway, ns ? 5 : 6, ns ? 6 : 5), `${group.id}: approach ${structure.id}`)
          .toBeGreaterThanOrEqual(radius + 1);
      }
      // Spheres enclose rotated blocks, including ramps, terraces and roof access;
      // deliberately conservative rather than checking only a decoration's center.
      for (const block of BR_MAP_BLOCKS) expect(Math.hypot(p.x - block.position.x, p.z - block.position.z), `${group.id}: block ${block.id}`)
        .toBeGreaterThanOrEqual(Math.hypot(block.size.x, block.size.y, block.size.z) / 2 + radius + 2);
      for (const plan of BR_DISTRICT_PLANS) expect(Math.hypot(p.x - plan.openZone.position.x, p.z - plan.openZone.position.z), `${group.id}: open ${plan.id}`)
        .toBeGreaterThanOrEqual(plan.openZone.radius + radius + 1);
      for (const loot of BR_LOOT_SOCKETS) expect(Math.hypot(p.x - loot.position.x, p.z - loot.position.z), `${group.id}: loot ${loot.id}`)
        .toBeGreaterThanOrEqual(radius + 1);
      for (const traversal of BR_TRAVERSAL) expect(Math.hypot(p.x - traversal.position.x, p.z - traversal.position.z), `${group.id}: traversal ${traversal.id}`)
        .toBeGreaterThanOrEqual(radius + 8);
    }
  });

  it("contains every part footprint within the island and its isolated pocket", () => {
    const all = groups();
    for (const [index, group] of all.entries()) {
      const p = group.center;
      let inside = false;
      for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
        const [x, z] = BR_ISLAND_OUTLINE[i], [px, pz] = BR_ISLAND_OUTLINE[j];
        expect(segmentDistance(p, { x, z }, { x: px, z: pz }), group.id).toBeGreaterThanOrEqual(group.radius + 5);
        if ((z > p.z) !== (pz > p.z) && p.x < (px - x) * (p.z - z) / (pz - z) + x) inside = !inside;
      }
      expect(inside, group.id).toBe(true);
      for (const other of all.slice(index + 1)) expect(Math.hypot(p.x - other.center.x, p.z - other.center.z))
        .toBeGreaterThanOrEqual(group.radius + other.radius + 2);
      for (const part of group.parts) {
        const factor = part.geometry === "box" ? .5 : 1;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = part.position.x - p.x + Math.cos(part.rotationY) * sx * part.scale.x * factor + Math.sin(part.rotationY) * sz * part.scale.z * factor;
          const z = part.position.z - p.z - Math.sin(part.rotationY) * sx * part.scale.x * factor + Math.cos(part.rotationY) * sz * part.scale.z * factor;
          expect(Math.hypot(x, z), `${group.id}: ${part.name}`).toBeLessThan(group.radius);
        }
      }
    }
  });

  it("has finite low surfaces, open frames, slender stems and no opaque non-colliding cover", () => {
    for (const group of groups()) {
      const surfaces = group.parts.filter(part => part.surface);
      expect(surfaces.length).toBeGreaterThanOrEqual(2);
      // Even summing overlapping inlays, each footprint treatment is under 18m².
      expect(surfaces.reduce((area, part) => area + part.scale.x * part.scale.z, 0)).toBeLessThan(18);
      for (const part of group.parts) {
        expect([...Object.values(part.position), part.rotationY].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(n => Number.isFinite(n) && n > 0)).toBe(true);
        const yFactor = part.geometry === "octahedron" ? 1 : .5;
        const bottom = part.position.y - part.scale.y * yFactor, top = part.position.y + part.scale.y * yFactor;
        expect(bottom).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThanOrEqual(5);
        if (part.surface) {
          expect(part.geometry).toBe("box");
          expect(top).toBeLessThanOrEqual(.041);
        } else if (part.finish === "canopy") {
          expect(bottom).toBeGreaterThanOrEqual(2.4);
          expect(part.geometry).toBe("octahedron");
        } else if (bottom > 2.7) {
          // An open, supported header; never an opaque shelter roof or signboard.
          expect(part.scale.y).toBeLessThanOrEqual(.12);
          expect(part.scale.z).toBeLessThanOrEqual(.16);
          expect(group.parts.filter(p => p.name.startsWith("frame-") && p.scale.y > 2)).toHaveLength(2);
        } else if (top > .45) {
          const factor = part.geometry === "cylinder" ? 2 : 1;
          expect(part.scale.x * factor).toBeLessThanOrEqual(.18);
          expect(part.scale.z * factor).toBeLessThanOrEqual(.18);
        }
      }
    }
  });
});
