import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP_BLOCKS,
  BR_ROADS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, BR_TRAVERSAL, brAuthoredDeckHeight,
} from "@planetfall/shared";
import {
  buildBrAuthoredSecondaryDressing, buildBrAuthoredTransitionDressing,
  type BrAuthoredSecondaryDressing,
} from "./br-authored-secondary-dressing";
import { blockClearance, partHeightBounds } from "./br-presentation-clearance-test-utils";

// These newly authored blocks do not reuse the legacy eight-part civic pocket.
// Transfer currently uses the existing structure-shell kit; dedicated street
// dressing remains a separate presentation milestone, not implicit coverage.
const dedicatedSiteIds=["transit-court","south-exchange","farm-transfer","solar-service","ring-service","west-junction"];
const legacySites=BR_SECONDARY_LOCATIONS.filter(site=>!dedicatedSiteIds.includes(site.id));

const groups = (): BrAuthoredSecondaryDressing[] => [
  ...legacySites.map(site => buildBrAuthoredSecondaryDressing(site)!),
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
  it("anchors every fixed pocket to its actual deck, including pockets inside another district",()=>{
    for(const group of groups()){
      const deck=brAuthoredDeckHeight(group.center)||BR_DISTRICT_PLANS.find(plan=>plan.id===group.id)?.elevation||0;
      expect(group.center.y,group.id).toBe(deck);
      for(const part of group.parts.filter(part=>part.surface))expect(part.position.y+part.scale.y/2-deck).toBeLessThanOrEqual(.041);
    }
  });
  it("keeps Relay Market's waiting pocket on the warehouse-west forecourt away from the new avenue",()=>{
    const group=buildBrAuthoredSecondaryDressing({id:"relay-market"})!;
    expect(group.center).toEqual({x:42,y:0,z:-89});
    expect(group.parts).toHaveLength(8);
    const warehouse=BR_STRUCTURES.find(s=>s.id==="relay-market-3")!;
    expect(group.center.x+group.radius).toBeLessThan(warehouse.position.x-warehouse.size.x/2);
    const avenue=BR_ROADS.filter(r=>r.id.startsWith("central-market-avenue"));
    expect(avenue.length).toBeGreaterThan(0);
    for(const road of avenue)expect(segmentDistance(group.center,road.from,road.to)-road.width/2-group.radius).toBeGreaterThan(7);
    expect(group.parts.find(p=>p.name==="walk-strip")!.position.z).toBeGreaterThan(group.center.z);
    expect(group.parts.find(p=>p.name==="frame-header")!.position.z).toBeLessThan(group.center.z);
  });
  it("anchors raised district pockets to their real deck while all four independent route pockets stay on ground",()=>{
    for(const id of ["east-checkpoint","academy-commons","south-terminal","south-shipworks"]){
      const plan=BR_DISTRICT_PLANS.find(plan=>plan.id===id)!;
      const group=buildBrAuthoredSecondaryDressing({id})!;
      expect(plan.elevation).toBeGreaterThan(0);
      expect(group.center.y).toBe(plan.elevation);
      const deck=BR_MAP_BLOCKS.find(block=>block.kind==="platform"
        &&Math.abs(block.position.y+block.size.y/2-plan.elevation)<.001
        &&Math.abs(group.center.x-block.position.x)+group.radius<=block.size.x/2
        &&Math.abs(group.center.z-block.position.z)+group.radius<=block.size.z/2);
      expect(deck,`${id} supporting deck`).toBeDefined();
      for(const part of group.parts){
        const bottom=part.position.y-part.scale.y*(part.geometry==="octahedron"?1:.5);
        expect(bottom).toBeGreaterThan(plan.elevation);
        if(part.surface)expect(part.position.y+part.scale.y/2-plan.elevation).toBeLessThanOrEqual(.041);
      }
    }
    for(const group of buildBrAuthoredTransitionDressing()){
      expect(group.center.y).toBe(0);
      expect(group.parts[0].position.y).toBe(.016);
      for(const part of group.parts.filter(part=>part.surface))expect(part.position.y+part.scale.y/2).toBeLessThanOrEqual(.041);
    }
  });
  it("covers all 30 sites, all seven contexts and four exact route gaps with 272 fixed parts", () => {
    const before = JSON.stringify([BR_SECONDARY_LOCATIONS, BR_DISTRICT_PLANS, BR_MAP_BLOCKS]);
    const all = groups();
    expect(legacySites).toHaveLength(30);
    for(const id of dedicatedSiteIds){
      expect(BR_SECONDARY_LOCATIONS.find(site=>site.id===id),id).toBeDefined();
      expect(buildBrAuthoredSecondaryDressing({id}),id).toBeUndefined();
    }
    expect(all).toHaveLength(34);
    expect(new Set(all.map(group => group.id)).size).toBe(34);
    expect(new Set(all.map(group => group.family)).size).toBe(7);
    expect(all.flatMap(group => group.parts)).toHaveLength(272);
    for (const site of legacySites) {
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
      const {bottom,top}=partHeightBounds(group.parts);
      for (const block of BR_MAP_BLOCKS) {
        expect(blockClearance(p,bottom,top,block),`${group.id}: block ${block.id}`)
          .toBeGreaterThanOrEqual(radius+2);
      }
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
        expect(bottom).toBeGreaterThanOrEqual(group.center.y);
        expect(top).toBeLessThanOrEqual(group.center.y+5);
        if (part.surface) {
          expect(part.geometry).toBe("box");
          expect(top).toBeLessThanOrEqual(group.center.y+.041);
        } else if (part.finish === "canopy") {
          expect(bottom).toBeGreaterThanOrEqual(group.center.y+2.4);
          expect(part.geometry).toBe("octahedron");
        } else if (bottom > group.center.y+2.7) {
          // An open, supported header; never an opaque shelter roof or signboard.
          expect(part.scale.y).toBeLessThanOrEqual(.12);
          expect(part.scale.z).toBeLessThanOrEqual(.16);
          expect(group.parts.filter(p => p.name.startsWith("frame-") && p.scale.y > 2)).toHaveLength(2);
        } else if (top > group.center.y+.45) {
          const factor = part.geometry === "cylinder" ? 2 : 1;
          expect(part.scale.x * factor).toBeLessThanOrEqual(.18);
          expect(part.scale.z * factor).toBeLessThanOrEqual(.18);
        }
      }
    }
  });
});
