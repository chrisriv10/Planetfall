import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_ROADS, BR_LOOT_SOCKETS, BR_CRATE_SOCKETS, brAuthoredDeckHeight } from "@planetfall/shared";
import { Box3, Vector3 } from "three";
import { buildBrCoolantFrontage } from "./br-coolant-frontage";
import { buildBrFacadeSkin } from "./br-facade-skin";
import { buildBrDoorwayParts } from "./br-facade-attachments";

const box = (p: { x: number; y: number; z: number }, s: { x: number; y: number; z: number }) =>
  new Box3().setFromCenterAndSize(new Vector3(p.x, p.y, p.z), new Vector3(s.x, s.y, s.z));

describe("Coolant Exchange clear frontage", () => {
  it("uses only measured authored buildings and sixteen independent borrowed box parts", () => {
    const snapshot = JSON.stringify(BR_STRUCTURES), kit = buildBrCoolantFrontage();
    expect(kit).toHaveLength(2); expect(kit.flatMap(k => k.parts)).toHaveLength(16);
    expect(buildBrCoolantFrontage()).toEqual(kit);
    expect(JSON.stringify(BR_STRUCTURES)).toBe(snapshot);
    expect(buildBrCoolantFrontage([])).toEqual([]);
    expect(buildBrCoolantFrontage(BR_STRUCTURES.map(s => ({ ...s, size: { ...s.size, y: s.size.y + 1 } })))).toEqual([]);
    for (const group of kit) for (const p of group.parts) {
      expect(p.geometry).toBe("box"); expect(p.rotationY).toBe(0);
      expect(Object.values(p.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(n => Number.isFinite(n) && n > 0)).toBe(true);
      for (const x of [-1, 1]) for (const z of [-1, 1]) expect(Math.hypot(
        p.position.x + x * p.scale.x / 2 - group.center.x, p.position.z + z * p.scale.z / 2 - group.center.z)).toBeLessThan(group.radius);
    }
    kit[0].parts[0].position.x = 0; expect(buildBrCoolantFrontage()[0].parts[0].position.x).not.toBe(0);
  });

  it("keeps all full footprints clear of roads, neighboring shells, loot and crates", () => {
    for (const group of buildBrCoolantFrontage()) for (const p of group.parts) {
      const bounds = box(p.position, p.scale);
      for (const s of BR_STRUCTURES.filter(s => `${s.id}-frontage` !== group.id)) expect(bounds.intersectsBox(
        box({ ...s.position, y: s.position.y + s.size.y / 2 }, s.size)), `${p.name}/${s.id}`).toBe(false);
      for (const loot of [...BR_LOOT_SOCKETS.map(l => l.position), ...BR_CRATE_SOCKETS]) expect(bounds.intersectsBox(
        box(loot, { x: 1.5, y: 1.5, z: 1.5 })), p.name).toBe(false);
      for (const r of BR_ROADS) {
        const dx = r.to.x - r.from.x, dz = r.to.z - r.from.z, length = Math.hypot(dx, dz); if (!length) continue;
        const ux = dx / length, uz = dz / length, cx = (r.from.x + r.to.x) / 2, cz = (r.from.z + r.to.z) / 2;
        expect([[1, 0], [0, 1], [ux, uz], [-uz, ux]].some(([ax, az]) =>
          Math.abs((p.position.x - cx) * ax + (p.position.z - cz) * az) >=
          Math.abs(ax) * p.scale.x / 2 + Math.abs(az) * p.scale.z / 2 +
          Math.abs(ax * ux + az * uz) * length / 2 + Math.abs(-ax * uz + az * ux) * r.width / 2 - 1e-8), `${p.name}/${r.id}`).toBe(true);
      }
      if (p.surface) {
        expect(bounds.min.y).toBeGreaterThanOrEqual(0); expect(bounds.max.y).toBeLessThanOrEqual(.04);
        for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) expect(brAuthoredDeckHeight({ x, z })).toBe(0);
      }
    }
  });

  it("aligns narrow aprons to doors and mounts plaques only on clear solid wall intervals", () => {
    for (const group of buildBrCoolantFrontage()) {
      const s = BR_STRUCTURES.find(s => `${s.id}-frontage` === group.id)!;
      const sign = s.entrance === "east" ? 1 : -1, wall = s.position.x + sign * s.size.x / 2;
      const apron = group.parts.find(p => p.name.endsWith("entry-apron"))!;
      expect(apron.position.z).toBe(s.position.z); expect(apron.scale.z).toBe(4.8);
      expect(apron.position.x - sign * apron.scale.x / 2).toBeCloseTo(wall + sign * .85);
      expect(apron.position.x + sign * apron.scale.x / 2).toBeCloseTo(37 - sign * 3.7);
      for (const p of group.parts.filter(p => !p.surface)) {
        const bounds = box(p.position, p.scale);
        expect(Math.abs(p.position.x - wall) - p.scale.x / 2).toBeGreaterThanOrEqual(.45);
        expect(Math.abs(p.position.x - wall) + p.scale.x / 2).toBeLessThan(.62);
        expect(bounds.max.z).toBeLessThan(s.position.z - 2.4);
        for (const other of [...buildBrFacadeSkin(s).filter(p => p.finish !== "panel"), ...buildBrDoorwayParts(s)])
          expect(bounds.intersectsBox(box({ ...other.position, y: other.position.y + s.position.y }, other.scale)), `${p.name}/${other.finish}`).toBe(false);
      }
    }
  });
});
