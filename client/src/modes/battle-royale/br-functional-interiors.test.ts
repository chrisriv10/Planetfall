import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES, type BrMapBlock } from "@planetfall/shared";
import { buildFunctionalInterior } from "./br-functional-interiors";

const supported = new Set([
  "warehouse", "hangar", "lab", "academy", "office", "industrial", "utility",
  "tower", "greenhouse", "transit"
]);
const overlaps = (a: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } },
  b: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } }, padding = 0) =>
  Math.abs(a.position.x - b.position.x) < (a.scale.x + b.scale.x) / 2 + padding
  && Math.abs(a.position.y - b.position.y) < (a.scale.y + b.scale.y) / 2 + padding
  && Math.abs(a.position.z - b.position.z) < (a.scale.z + b.scale.z) / 2 + padding;

describe("functional interior presentation", () => {
  it("uses only bounded wall, ceiling and inlay detail rather than freestanding false cover", () => {
    let total = 0, decorated = 0;
    for (const structure of BR_STRUCTURES) {
      const parts = buildFunctionalInterior(structure);
      if (!structure.enterable || !supported.has(structure.archetype)) {
        expect(parts).toEqual([]);
        continue;
      }
      total += parts.length;
      if (!parts.length) continue; // A loot socket/partition may consume the only safe wall bay.
      decorated++;
      expect(parts.length).toBeLessThanOrEqual(40 * structure.floors);
      const roles = new Set(parts.map(part => part.role));
      expect(roles.has("wall")).toBe(true);
      expect(roles.has("inlay")).toBe(true);
      for (const part of parts) {
        expect([...Object.values(part.position), ...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(value => value > 0)).toBe(true);
        expect(part.position.y - part.scale.y / 2).toBeGreaterThanOrEqual(0);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(structure.size.y + .01);
        if (part.role === "ceiling") expect(part.position.y - part.scale.y / 2).toBeGreaterThan(3.1);
        if (part.role === "wall") expect(Math.min(part.scale.x, part.scale.z)).toBeLessThanOrEqual(.26);
      }
    }
    expect(total).toBeGreaterThan(300);
    expect(decorated).toBeGreaterThan(20);
  });

  it("attaches wall pieces to real solid walls and floor-level pieces to real slabs", () => {
    for (const structure of BR_STRUCTURES) for (const part of buildFunctionalInterior(structure)) {
      const worldPart = { ...part, position: { ...part.position, y: part.position.y + structure.position.y } };
      const walls = BR_MAP_BLOCKS.filter(block => block.kind === "wall" && block.id.startsWith(`${structure.id}-`)
        && !block.id.includes("door-"));
      const floors = BR_MAP_BLOCKS.filter(block => block.kind === "platform" && block.id.startsWith(`${structure.id}-`)
        && !block.id.endsWith("-roof"));
      if (part.role === "wall") expect(walls.some(wall => {
        const alongX = wall.size.x >= wall.size.z, lateral = alongX ? "x" : "z", normal = alongX ? "z" : "x";
        return Math.abs(worldPart.position[normal] - wall.position[normal]) < wall.size[normal] / 2 + .35
          && Math.abs(worldPart.position[lateral] - wall.position[lateral]) + worldPart.scale[lateral] / 2 < wall.size[lateral] / 2
          && worldPart.position.y - worldPart.scale.y / 2 >= wall.position.y - wall.size.y / 2
          && worldPart.position.y + worldPart.scale.y / 2 <= wall.position.y + wall.size.y / 2 + .01;
      }), `${structure.id} wall support`).toBe(true);
      if (part.role !== "ceiling") expect(floors.some(floor => floor.position.y + floor.size.y / 2 <= worldPart.position.y - worldPart.scale.y / 2 + .02
        && Math.abs(worldPart.position.x - floor.position.x) + worldPart.scale.x / 2 <= floor.size.x / 2 + .01
        && Math.abs(worldPart.position.z - floor.position.z) + worldPart.scale.z / 2 <= floor.size.z / 2 + .01),
      `${structure.id} ${part.role} floor support`).toBe(true);
    }
  });

  it("keeps loot, ramps and unrelated room partitions unobstructed", () => {
    for (const structure of BR_STRUCTURES) for (const part of buildFunctionalInterior(structure)) {
      const worldPart = { ...part, position: { ...part.position, y: part.position.y + structure.position.y } };
      for (const loot of BR_LOOT_SOCKETS.filter(socket => socket.structureId === structure.id)) expect(overlaps(
        worldPart, { position: loot.position, scale: { x: 1.2, y: 1.6, z: 1.2 } }, .25
      ), `${structure.id} loot ${loot.id}`).toBe(false);
      for (const block of BR_MAP_BLOCKS.filter(block => block.id.startsWith(`${structure.id}-`)
        && (block.kind === "ramp" || block.id.includes("-room-")))) {
        const alongX=block.size.x>=block.size.z,normal=alongX?"z":"x",lateral=alongX?"x":"z";
        if (part.role !== "inlay" && Math.min(part.scale.x, part.scale.z) <= .26
          && Math.abs(worldPart.position[normal]-block.position[normal])<block.size[normal]/2+.35
          && Math.abs(worldPart.position[lateral]-block.position[lateral])+worldPart.scale[lateral]/2<block.size[lateral]/2) continue;
        expect(overlaps(worldPart, { position: block.position, scale: block.size }, .075), `${structure.id} ${part.role} block ${block.id}`).toBe(false);
      }
    }
  });

  it("keeps local Y identical for the same authored plan at an elevated deck", () => {
    const source = BR_STRUCTURES.find(structure => structure.id === "dock-warehouse")!, offset = 6;
    const elevated = { ...source, position: { ...source.position, y: offset } };
    const shiftedBlocks: BrMapBlock[] = BR_MAP_BLOCKS.filter(block => block.id.startsWith(`${source.id}-`)).map(block => ({
      ...block, position: { ...block.position, y: block.position.y + offset }
    }));
    const shiftedLoot = BR_LOOT_SOCKETS.filter(socket => socket.structureId === source.id).map(socket => ({
      ...socket, position: { ...socket.position, y: socket.position.y + offset }
    }));
    const baseline = buildFunctionalInterior(source), raised = buildFunctionalInterior(elevated, shiftedBlocks, shiftedLoot);
    expect(raised).toHaveLength(baseline.length);
    for (let index = 0; index < baseline.length; index++) {
      expect(raised[index].finish).toBe(baseline[index].finish);
      expect(raised[index].role).toBe(baseline[index].role);
      expect(raised[index].scale).toEqual(baseline[index].scale);
      expect(raised[index].position.x).toBeCloseTo(baseline[index].position.x);
      expect(raised[index].position.y).toBeCloseTo(baseline[index].position.y);
      expect(raised[index].position.z).toBeCloseTo(baseline[index].position.z);
    }
  });

  it("gives tower, greenhouse and transit interiors distinct wall-bound identities", () => {
    const signatures = new Map<string, string>();
    for (const archetype of ["tower", "greenhouse", "transit"] as const) {
      const structure = BR_STRUCTURES.find(candidate => candidate.enterable && candidate.archetype === archetype);
      expect(structure, `${archetype} fixture`).toBeDefined();
      const parts = buildFunctionalInterior(structure!);
      expect(parts.length, `${archetype} dressing`).toBeGreaterThan(0);
      expect(parts.some(part => part.role === "wall"), `${archetype} wall identity`).toBe(true);
      expect(parts.some(part => part.role === "inlay"), `${archetype} flush guidance`).toBe(true);
      expect(parts.filter(part => part.role === "wall").every(part => Math.min(part.scale.x, part.scale.z) <= .26)).toBe(true);
      signatures.set(archetype, parts.map(part => `${part.finish}:${part.role}:${part.scale.x.toFixed(2)}:${part.scale.y.toFixed(2)}:${part.scale.z.toFixed(2)}`).join("|"));
    }
    expect(new Set(signatures.values()).size).toBe(3);
  });

  it("uses the projected world height of inclined ramps when rejecting a wall bay", () => {
    const structure = BR_STRUCTURES.find(candidate => candidate.id === "dock-warehouse")!;
    const sourceBlocks = BR_MAP_BLOCKS.filter(block => block.id.startsWith(`${structure.id}-`));
    const baseline = buildFunctionalInterior(structure, sourceBlocks);
    const mount = baseline.find(part => part.role === "wall")!;
    expect(mount).toBeDefined();
    const top = mount.position.y + structure.position.y + mount.scale.y / 2;
    const ramp: BrMapBlock = {
      id: `${structure.id}-inclined-clearance-test`, districtId: structure.districtId, kind: "ramp", color: "#fff",
      position: { x: mount.position.x, y: top + 1, z: mount.position.z },
      size: { x: .4, y: .2, z: 6 }, rotation: { x: Math.PI / 4, y: 0, z: 0 }
    };
    // Raw height (.2m) would miss the bay; its inclined world projection
    // extends more than four metres vertically and must reserve the space.
    expect(ramp.position.y-ramp.size.y/2).toBeGreaterThan(top);
    expect(buildFunctionalInterior(structure, [...sourceBlocks, ramp]).length).toBeLessThan(baseline.length);
  });

  it("fails closed when walls, floors or valid dimensions are unavailable", () => {
    const structure = BR_STRUCTURES.find(candidate => candidate.id === "dock-warehouse")!;
    expect(buildFunctionalInterior(structure, [])).toEqual([]);
    expect(buildFunctionalInterior({ ...structure, enterable: false })).toEqual([]);
    const malformed = BR_MAP_BLOCKS.filter(block => block.id.startsWith(`${structure.id}-`)).map(block =>
      block.id === `${structure.id}-back` ? { ...block, size: { ...block.size, z: Number.NaN } } : block);
    expect(buildFunctionalInterior(structure, malformed)).toEqual([]);
  });
});
