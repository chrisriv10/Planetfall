import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildMallDirectories } from "./br-mall-directories";
import { buildMallWallBays } from "./br-mall-wall-bays";

const malls = BR_STRUCTURES.filter(s => ["void-anchor", "void-food-court"].includes(s.id));

describe("mall directory wall architecture", () => {
  it("is deterministic, limited to supported directory walls and modest in count", () => {
    const before = JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS]);
    expect(BR_STRUCTURES.filter(s => buildMallWallBays(s).length).map(s => s.id).sort()).toEqual(["void-anchor", "void-food-court"]);
    for (const structure of malls) {
      const bays = buildMallWallBays(structure);
      expect(bays).toHaveLength(2);
      expect(buildMallWallBays(structure)).toEqual(bays);
      expect(buildMallWallBays(structure, [...BR_MAP_BLOCKS].reverse())).toEqual(bays);
      for (const bay of bays) {
        expect(bay.parts.length).toBeLessThanOrEqual(16);
        expect(bay.parts.filter(p => p.finish === "energyPurple")).toHaveLength(1);
        expect(bay.parts.filter(p => p.finish === "energyCyan")).toHaveLength(1);
      }
    }
    expect(JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS])).toBe(before);
  });

  it("fits entirely in the supporting wall skin and below the real ceiling", () => {
    for (const structure of malls) for (const bay of buildMallWallBays(structure)) {
      const wall = BR_MAP_BLOCKS.find(b => b.id === bay.wallId)!;
      const floor = BR_MAP_BLOCKS.find(b => b.id === bay.floorId)!;
      const face = wall.position.x + wall.size.x / 2;
      const base = floor.position.y + floor.size.y / 2;
      for (const part of bay.parts) {
        expect(part.position.x - part.scale.x / 2).toBeGreaterThan(face);
        expect(part.position.x + part.scale.x / 2).toBeLessThan(face + .25);
        expect(part.position.y - part.scale.y / 2).toBeGreaterThanOrEqual(base - 1e-10);
        expect(Math.abs(part.position.z - wall.position.z) + part.scale.z / 2).toBeLessThan(wall.size.z / 2 - .3);
        expect(Math.abs(part.position.z - floor.position.z) + part.scale.z / 2).toBeLessThan(floor.size.z / 2);
        const ceiling = BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-`) && b.kind === "platform"
          && b.position.y > floor.position.y + .5 && Math.abs(part.position.x - b.position.x) < b.size.x / 2
          && Math.abs(part.position.z - b.position.z) + part.scale.z / 2 < b.size.z / 2)
          .reduce((min, b) => Math.min(min, b.position.y - b.size.y / 2), Infinity);
        expect(part.position.y + part.scale.y / 2).toBeLessThan(ceiling);
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(v => Number.isFinite(v) && v > 0)).toBe(true);
      }
    }
  });

  it("preserves directory visibility, loot sockets, doors and stairs", () => {
    for (const structure of malls) {
      const directories = buildMallDirectories(structure);
      for (const bay of buildMallWallBays(structure)) for (const part of bay.parts) {
        const directory = directories.find(d => d.floorId === bay.floorId)!;
        for (const label of directory.signs) {
          const overlapsLabel = Math.abs(part.position.z - label.position.z) < part.scale.z / 2 + label.width / 2
            && Math.abs(part.position.y - label.position.y) < part.scale.y / 2 + label.height / 2;
          expect(overlapsLabel).toBe(false);
        }
        for (const loot of BR_LOOT_SOCKETS.filter(s => s.structureId === structure.id)) {
          expect(Math.abs(part.position.x - loot.position.x)).toBeGreaterThan(part.scale.x / 2 + .6);
        }
        for (const stair of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-stairs-`)))
          expect(part.position.x + part.scale.x / 2 + 1).toBeLessThan(stair.position.x - stair.size.x / 2);
        // Anchor's south entrance is centered; food court's east entrance is
        // on the opposite wall. Neither intersects this narrow west-wall skin.
        expect(part.position.x + part.scale.x / 2).toBeLessThan(structure.position.x - 2.4);
      }
    }
  });

  it("omits bays without their wall, supported floor, or enough wall span", () => {
    const anchor = malls[0];
    expect(buildMallWallBays(anchor, [])).toEqual([]);
    expect(buildMallWallBays({ ...anchor, enterable: false })).toEqual([]);
    const noWall = BR_MAP_BLOCKS.filter(b => b.id !== `${anchor.id}-west`);
    expect(buildMallWallBays(anchor, noWall)).toEqual([]);
    const narrowWall = BR_MAP_BLOCKS.map(b => b.id === `${anchor.id}-west`
      ? { ...b, size: { ...b.size, z: 2 } } : b);
    expect(buildMallWallBays(anchor, narrowWall)).toEqual([]);
  });
});
