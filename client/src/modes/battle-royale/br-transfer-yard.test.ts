import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_ROADS, BR_LOOT_SOCKETS, BR_CRATE_SOCKETS, brAuthoredDeckHeight } from "@planetfall/shared";
import { buildBrTransferYardDressing } from "./br-transfer-yard";

describe("Transfer Yard entry walks", () => {
  it("joins each actual doorway to its street with one narrow shared-material surface", () => {
    const before = JSON.stringify([BR_STRUCTURES, BR_ROADS]);
    const kit = buildBrTransferYardDressing()!;
    expect(kit.parts).toHaveLength(3);
    expect(new Set(kit.parts.map(p => `${p.geometry}:${p.finish}:${p.surface}`)).size).toBe(1);
    const road = BR_ROADS.find(r => r.id === "transfer-yard-main")!;
    for (const structure of BR_STRUCTURES.filter(s => s.districtId === "transfer-yard")) {
      const walk = kit.parts.find(p => p.name === `${structure.id}-door-walk`)!;
      const sign = structure.entrance === "east" ? 1 : -1;
      expect(walk.position.z).toBe(structure.position.z);
      expect(walk.scale.z).toBe(4.8);
      expect(walk.position.x - sign * walk.scale.x / 2).toBeCloseTo(structure.position.x + sign * (structure.size.x / 2 + .375));
      expect(walk.position.x + sign * walk.scale.x / 2).toBeCloseTo(road.from.x - sign * (road.width / 2 + .15));
      expect(walk.position.y + walk.scale.y / 2).toBeCloseTo(.028);
      expect(walk.surface).toBe(true);
      expect(walk.rotationY).toBe(0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const point = { x: walk.position.x + sx * walk.scale.x / 2, z: walk.position.z + sz * walk.scale.z / 2 };
        expect(brAuthoredDeckHeight(point)).toBe(0);
        expect(Math.hypot(point.x - kit.center.x, point.z - kit.center.z)).toBeLessThan(kit.radius);
      }
    }
    expect(buildBrTransferYardDressing()).toEqual(kit);
    expect(JSON.stringify([BR_STRUCTURES, BR_ROADS])).toBe(before);
  });

  it("clears full road and shell footprints, loot and crates without overlapping patches", () => {
    const parts = buildBrTransferYardDressing()!.parts;
    for (const [index, p] of parts.entries()) {
      for (const other of parts.slice(index + 1)) expect(Math.min(
        (p.scale.x + other.scale.x) / 2 - Math.abs(p.position.x - other.position.x),
        (p.scale.z + other.scale.z) / 2 - Math.abs(p.position.z - other.position.z))).toBeLessThanOrEqual(0);
      for (const s of BR_STRUCTURES) expect(
        Math.abs(p.position.x - s.position.x) >= (p.scale.x + s.size.x) / 2 + .325 - 1e-8
        || Math.abs(p.position.z - s.position.z) >= (p.scale.z + s.size.z) / 2 + .325 - 1e-8, `${p.name}: ${s.id}`).toBe(true);
      for (const loot of [...BR_LOOT_SOCKETS.map(l => l.position), ...BR_CRATE_SOCKETS]) expect(
        Math.abs(p.position.x - loot.x) >= p.scale.x / 2 + 1
        || Math.abs(p.position.z - loot.z) >= p.scale.z / 2 + 1, `${p.name}: loot/crate`).toBe(true);
      for (const r of BR_ROADS) {
        const dx = r.to.x - r.from.x, dz = r.to.z - r.from.z, length = Math.hypot(dx, dz);
        if (!length) continue;
        const ux = dx / length, uz = dz / length, cx = (r.from.x + r.to.x) / 2, cz = (r.from.z + r.to.z) / 2;
        expect([[1, 0], [0, 1], [ux, uz], [-uz, ux]].some(([ax, az]) =>
          Math.abs((p.position.x - cx) * ax + (p.position.z - cz) * az) >=
          Math.abs(ax) * p.scale.x / 2 + Math.abs(az) * p.scale.z / 2 +
          Math.abs(ax * ux + az * uz) * length / 2 + Math.abs(-ax * uz + az * ux) * r.width / 2 - 1e-8), `${p.name}: ${r.id}`).toBe(true);
      }
    }
  });

  it("declines unsupported or incompatible inputs and returns independent parts", () => {
    expect(buildBrTransferYardDressing({ structures: [], roads: BR_ROADS })).toBeUndefined();
    expect(buildBrTransferYardDressing({ structures: BR_STRUCTURES, roads: [] })).toBeUndefined();
    for (const change of [
      (s: typeof BR_STRUCTURES[number]) => ({ ...s, position: { ...s.position, y: 5 } }),
      (s: typeof BR_STRUCTURES[number]) => ({ ...s, entrance: "north" as const }),
    ]) expect(buildBrTransferYardDressing({ structures: BR_STRUCTURES.map(s => s.districtId === "transfer-yard" ? change(s) : s), roads: BR_ROADS })).toBeUndefined();
    expect(buildBrTransferYardDressing({ structures: BR_STRUCTURES,
      roads: BR_ROADS.map(r => r.id === "transfer-yard-main" ? { ...r, to: { ...r.to, y: 3 } } : r) })).toBeUndefined();
    const kit = buildBrTransferYardDressing()!;
    kit.parts[0].position.x = 0;
    expect(buildBrTransferYardDressing()!.parts[0].position.x).not.toBe(0);
  });
});
