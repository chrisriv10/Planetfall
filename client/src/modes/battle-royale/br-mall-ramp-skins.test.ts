import { describe, expect, it } from "vitest";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_STRUCTURES, BR_TRAVERSAL } from "@planetfall/shared";
import { buildMallRampSkins } from "./br-mall-ramp-skins";

const malls = BR_STRUCTURES.filter(s => s.districtId === "void-mall" && s.archetype === "mall");

describe("Void Mall ramp underside skins", () => {
  it("decorates only supported authored interior mall ramps with a fixed budget", () => {
    let count = 0;
    const before = JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS]);
    for (const structure of BR_STRUCTURES) {
      const skins = buildMallRampSkins(structure);
      expect(buildMallRampSkins(structure, [...BR_MAP_BLOCKS].reverse())).toEqual(skins);
      expect(skins.length).toBeLessThanOrEqual(2);
      for (const skin of skins) {
        count++;
        expect(structure.districtId).toBe("void-mall");
        expect(structure.archetype).toBe("mall");
        expect(skin.rampId).toMatch(new RegExp(`^${structure.id}-stairs-[12]$`));
        expect(skin.parts).toHaveLength(10);
      }
    }
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(8);
    expect(JSON.stringify([BR_STRUCTURES, BR_MAP_BLOCKS])).toBe(before);
  });

  it("keeps every part beneath and inside the actual rotated ramp envelope", () => {
    for (const structure of malls) for (const skin of buildMallRampSkins(structure)) {
      const ramp = BR_MAP_BLOCKS.find(b => b.id === skin.rampId)!;
      for (const part of skin.parts) {
        expect(Object.values(part.position).every(Number.isFinite)).toBe(true);
        expect(Object.values(part.scale).every(v => Number.isFinite(v) && v > 0)).toBe(true);
        expect(part.rotationX).toBe(ramp.rotation!.x);
        const dy = part.position.y - ramp.position.y, dz = part.position.z - ramp.position.z;
        const localY = dy * Math.cos(part.rotationX) + dz * Math.sin(part.rotationX);
        const localZ = -dy * Math.sin(part.rotationX) + dz * Math.cos(part.rotationX);
        expect(Math.abs(part.position.x - ramp.position.x) + part.scale.x / 2).toBeLessThan(ramp.size.x / 2);
        expect(Math.abs(localZ) + part.scale.z / 2).toBeLessThanOrEqual(ramp.size.z / 2 - .9 + 1e-9);
        expect(localY + part.scale.y / 2).toBeLessThan(-ramp.size.y / 2);
        expect(localY - part.scale.y / 2).toBeGreaterThan(-ramp.size.y / 2 - .14);
      }
    }
  });

  it("leaves upper landings, loot and traversal volumes clear", () => {
    for (const structure of malls) for (const skin of buildMallRampSkins(structure)) {
      const level = skin.rampId.split("-").at(-1);
      const landing = BR_MAP_BLOCKS.find(b => b.id === `${structure.id}-deck-${level}-landing`)!;
      for (const part of skin.parts) {
        const halfY = Math.abs(Math.cos(part.rotationX)) * part.scale.y / 2 + Math.abs(Math.sin(part.rotationX)) * part.scale.z / 2;
        const halfZ = Math.abs(Math.sin(part.rotationX)) * part.scale.y / 2 + Math.abs(Math.cos(part.rotationX)) * part.scale.z / 2;
        expect(part.position.y + halfY).toBeLessThan(landing.position.y - landing.size.y / 2);
        for (const loot of BR_LOOT_SOCKETS.filter(s => s.structureId === structure.id)) {
          const overlap = Math.abs(part.position.x - loot.position.x) < part.scale.x / 2 + .5
            && Math.abs(part.position.y - loot.position.y) < halfY + .5
            && Math.abs(part.position.z - loot.position.z) < halfZ + .5;
          expect(overlap).toBe(false);
        }
        for (const traversal of BR_TRAVERSAL)
          expect(Math.hypot(part.position.x - traversal.position.x, part.position.z - traversal.position.z)).toBeGreaterThan(8);
      }
    }
  });

  it("skips missing supports, unsupported transforms and malformed dimensions", () => {
    const anchor = malls.find(s => s.id === "void-anchor")!;
    expect(buildMallRampSkins(anchor)).toHaveLength(1);
    expect(buildMallRampSkins({ ...anchor, enterable: false })).toEqual([]);
    expect(buildMallRampSkins(anchor, [])).toEqual([]);
    expect(buildMallRampSkins(anchor, BR_MAP_BLOCKS.filter(b => b.id !== "void-anchor-deck-1-landing"))).toEqual([]);
    for (const change of [
      { rotation: { x: .5, y: .1, z: 0 } },
      { rotation: { x: NaN, y: 0, z: 0 } },
      { size: { x: 0, y: .32, z: 10 } },
      { position: { x: 200, y: 4.5, z: 200 } }
    ]) {
      const blocks = BR_MAP_BLOCKS.map(b => b.id === "void-anchor-stairs-1" ? { ...b, ...change } : b);
      expect(buildMallRampSkins(anchor, blocks)).toEqual([]);
    }
  });
});
