import { describe, expect, it } from "vitest";
import { BR_MAP_BLOCKS, BR_STRUCTURES } from "@planetfall/shared";
import { buildMallAtriumWalls } from "./br-mall-atrium-walls";

describe("Void Mall atrium wall articulation", () => {
  const anchor = BR_STRUCTURES.find(structure => structure.id === "void-anchor")!;

  it("is deterministic, scoped to the tall mall anchor and bounded", () => {
    const before = JSON.stringify([anchor, BR_MAP_BLOCKS]);
    const parts = buildMallAtriumWalls(anchor);
    expect(parts.length).toBeGreaterThan(100);
    expect(parts.length).toBeLessThanOrEqual(240);
    expect(buildMallAtriumWalls(anchor)).toEqual(parts);
    expect(buildMallAtriumWalls(anchor, [...BR_MAP_BLOCKS].reverse())).toEqual(parts);
    expect(new Set(parts.map(part => part.finish))).toEqual(new Set(["frame", "panel", "glass", "energyPurple", "energyCyan"]));
    expect(JSON.stringify([anchor, BR_MAP_BLOCKS])).toBe(before);
    expect(buildMallAtriumWalls({ ...anchor, archetype: "office" })).toEqual([]);
    expect(buildMallAtriumWalls({ ...anchor, enterable: false })).toEqual([]);
    const shortMall = BR_STRUCTURES.find(structure => structure.id === "void-west")!;
    expect(buildMallAtriumWalls(shortMall)).toEqual([]);
  });

  it("keeps every part shallow, finite and supported by its real wall segment", () => {
    for (const part of buildMallAtriumWalls(anchor)) {
      const wall = BR_MAP_BLOCKS.find(block => block.id === part.wallId)!;
      expect(wall).toBeDefined();
      expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect(Math.min(part.scale.x, part.scale.z)).toBeLessThanOrEqual(.16);
      expect(part.position.y - part.scale.y / 2).toBeGreaterThanOrEqual(0);
      expect(part.position.y + part.scale.y / 2).toBeLessThanOrEqual(anchor.size.y);
      if (wall.size.x >= wall.size.z) {
        expect(Math.abs(part.position.x - wall.position.x) + part.scale.x / 2).toBeLessThanOrEqual(wall.size.x / 2 + .001);
        expect(Math.abs(part.position.z - wall.position.z)).toBeLessThan(.4);
      } else {
        expect(Math.abs(part.position.z - wall.position.z) + part.scale.z / 2).toBeLessThanOrEqual(wall.size.z / 2 + .001);
        expect(Math.abs(part.position.x - wall.position.x)).toBeLessThan(.4);
      }
    }
  });

  it("mounts only on wall pieces, preserving the real entrance gap", () => {
    const parts = buildMallAtriumWalls(anchor);
    const entranceWalls = BR_MAP_BLOCKS.filter(block => block.id.startsWith(`${anchor.id}-door-`));
    expect(entranceWalls).toHaveLength(2);
    const entranceZ = anchor.position.z - anchor.size.z / 2;
    for (const part of parts.filter(item => item.wallId.includes("-door-"))) {
      expect(Math.abs(part.position.z - entranceZ)).toBeLessThan(.4);
      expect(Math.abs(part.position.x - anchor.position.x) - part.scale.x / 2).toBeGreaterThanOrEqual(2.39);
    }
    expect(parts.some(part => Math.abs(part.position.x - anchor.position.x) < 2.4
      && Math.abs(part.position.z - entranceZ) < .4)).toBe(false);
  });
});
