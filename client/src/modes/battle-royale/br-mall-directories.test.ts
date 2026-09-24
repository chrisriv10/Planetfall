import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildMallDirectories } from "./br-mall-directories";

const malls = BR_STRUCTURES.filter(s => ["void-anchor", "void-food-court"].includes(s.id));

describe("mall interior directory mounts", () => {
  it("gives the anchor and food court distinct, bounded identity on both real levels", () => {
    expect(BR_STRUCTURES.filter(s => buildMallDirectories(s).length).map(s => s.id).sort()).toEqual(["void-anchor", "void-food-court"]);
    for (const structure of malls) {
      const directories = buildMallDirectories(structure);
      expect(directories).toHaveLength(2);
      expect(buildMallDirectories(structure)).toEqual(directories);
      expect(buildMallDirectories(structure, [...BR_MAP_BLOCKS].reverse())).toEqual(directories);
      expect(directories.reduce((sum, d) => sum + d.parts.length, 0)).toBeLessThanOrEqual(21);
      expect(directories[0].signs[0].text).toBe(structure.id === "void-anchor" ? "VOID MALL" : "FOOD COURT");
      expect(directories[1].signs.some(s => s.text === "LEVEL 02")).toBe(true);
    }
  });

  it("keeps every box and label on its supporting wall and actual floor", () => {
    for (const structure of malls) for (const directory of buildMallDirectories(structure)) {
      const wall = BR_MAP_BLOCKS.find(b => b.id === directory.wallId)!;
      const floor = BR_MAP_BLOCKS.find(b => b.id === directory.floorId)!;
      const face = wall.position.x + wall.size.x / 2;
      const base = floor.position.y + floor.size.y / 2;
      for (const part of directory.parts) {
        expect(part.position.x - part.scale.x / 2).toBeGreaterThan(face);
        expect(part.position.x + part.scale.x / 2).toBeLessThan(face + .55);
        expect(part.position.y - part.scale.y / 2).toBeGreaterThan(base + .6);
        expect(Math.abs(part.position.z - floor.position.z) + part.scale.z / 2).toBeLessThan(floor.size.z / 2);
        expect(Object.values(part.scale).every(n => Number.isFinite(n) && n > 0)).toBe(true);
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      }
      for (const label of directory.signs) {
        expect(label.position.x).toBeCloseTo(face + .325);
        expect(Math.abs(label.position.z - wall.position.z) + label.width / 2).toBeLessThan(wall.size.z / 2);
        expect(label.width).toBeLessThan(3);
        expect(label.rotationY).toBe(Math.PI / 2);
      }
    }
  });

  it("leaves loot and stair lanes clear and does not fill the central room", () => {
    for (const structure of malls) for (const directory of buildMallDirectories(structure)) {
      for (const part of directory.parts) {
        expect(part.position.x + part.scale.x / 2).toBeLessThan(structure.position.x - structure.size.x / 2 + 1);
        for (const loot of BR_LOOT_SOCKETS.filter(s => s.structureId === structure.id)) {
          const overlapping = Math.abs(part.position.x - loot.position.x) < part.scale.x / 2 + .6
            && Math.abs(part.position.y - loot.position.y) < part.scale.y / 2 + .6
            && Math.abs(part.position.z - loot.position.z) < part.scale.z / 2 + .6;
          expect(overlapping).toBe(false);
        }
        for (const stair of BR_MAP_BLOCKS.filter(b => b.id.startsWith(`${structure.id}-stairs-`))) {
          expect(part.position.x + part.scale.x / 2 + 1).toBeLessThan(stair.position.x - stair.size.x / 2);
        }
      }
    }
  });

  it("omits unsupported directories when walls, floors or overhead clearance are absent", () => {
    const structure = malls[0];
    expect(buildMallDirectories({ ...structure, enterable: false })).toEqual([]);
    expect(buildMallDirectories(structure, [])).toEqual([]);
    expect(buildMallDirectories(structure, BR_MAP_BLOCKS.filter(b => b.id !== `${structure.id}-west`))).toEqual([]);
    expect(buildMallDirectories(structure, BR_MAP_BLOCKS.filter(b => b.kind !== "platform"))).toEqual([]);
    const lowCeilings = BR_MAP_BLOCKS.map(b => b.id.startsWith(`${structure.id}-`) && b.kind === "platform"
      ? { ...b, position: { ...b.position, y: b.position.y / 10 } } : b);
    expect(buildMallDirectories(structure, lowCeilings)).toEqual([]);
  });
});
