import { describe, expect, it } from "vitest";
import { BR_STRUCTURES, BR_ROADS, BR_LOOT_SOCKETS } from "@planetfall/shared";
import { buildBrEngineGateFrontage } from "./br-engine-gate-frontage";
import { buildBrFacadeSkin } from "./br-facade-skin";
import { buildBrDoorwayParts } from "./br-facade-attachments";
import { Box3, Vector3 } from "three";

const box = (p: { x: number; y: number; z: number }, s: { x: number; y: number; z: number }) => new Box3().setFromCenterAndSize(new Vector3(p.x, p.y, p.z), new Vector3(s.x, s.y, s.z));
describe("Dock–Engine authored compound frontage", () => {
  it("uses both actual structures with deterministic independent bounded box parts", () => {
    const snapshot = structuredClone(BR_STRUCTURES), a = buildBrEngineGateFrontage(), b = buildBrEngineGateFrontage();
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
    expect(BR_STRUCTURES).toEqual(snapshot);
    expect(a.flatMap(p => p.parts)).toHaveLength(29);
    expect(new Set(a.flatMap(p => p.parts.map(p => p.name))).size).toBe(29);
    for (const pocket of a) for (const p of pocket.parts) {
      expect(p.geometry).toBe("box");
      expect(p.rotationY).toBe(0);
      expect(Object.values(p.position).every(Number.isFinite)).toBe(true);
      for (const x of [-1, 1]) for (const z of [-1, 1]) expect(Math.hypot(p.position.x + x * p.scale.x / 2 - pocket.center.x, p.position.z + z * p.scale.z / 2 - pocket.center.z)).toBeLessThan(pocket.radius);
    }
    a[0].parts[0].position.x = 0;
    expect(buildBrEngineGateFrontage()).toEqual(b);
  });

  it("keeps all ground graphics flush and the road and central court clear", () => {
    for (const pocket of buildBrEngineGateFrontage()) for (const p of pocket.parts) {
      const bounds = box(p.position, p.scale);
      expect(bounds.max.z < -189 || bounds.min.z > -170, p.name).toBe(true);
      expect(bounds.max.x, p.name).toBeLessThanOrEqual(334.2);
      if (p.surface) {
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.max.y).toBeLessThanOrEqual(.04);
        for (const road of BR_ROADS) {
          const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, l2 = dx * dx + dz * dz;
          const t = l2 ? Math.max(0, Math.min(1, ((p.position.x - road.from.x) * dx + (p.position.z - road.from.z) * dz) / l2)) : 0;
          const distance = Math.hypot(p.position.x - road.from.x - dx * t, p.position.z - road.from.z - dz * t);
          expect(distance - Math.hypot(p.scale.x, p.scale.z) / 2, `${p.name} / ${road.id}`).toBeGreaterThan(road.width / 2 + 1);
        }
      }
    }
  });

  it("mounts every raised part on solid facade and clears doors, glass and loot", () => {
    for (const pocket of buildBrEngineGateFrontage()) {
      const s = BR_STRUCTURES.find(s => `${s.id}-frontage` === pocket.id)!;
      expect(s.entrance).toBe("east");
      const wall = s.position.x + s.size.x / 2;
      for (const p of pocket.parts.filter(p => !p.surface)) {
        const bounds = box(p.position, p.scale);
        expect(bounds.min.x).toBeGreaterThanOrEqual(wall + .45);
        expect(bounds.max.x).toBeLessThanOrEqual(wall + .62);
        expect(bounds.max.z).toBeLessThan(s.position.z - 2.4);
        expect(bounds.max.y).toBeLessThan(s.position.y + 3.4);
        for (const other of [...buildBrFacadeSkin(s).filter(p => p.finish !== "panel"), ...buildBrDoorwayParts(s)]) {
          expect(bounds.intersectsBox(box({ ...other.position, y: other.position.y + s.position.y }, other.scale)), `${p.name} / ${other.finish}`).toBe(false);
        }
        for (const loot of BR_LOOT_SOCKETS) expect(bounds.intersectsBox(box(loot.position, { x: 1.5, y: 1.5, z: 1.5 })), `${p.name} / ${loot.id}`).toBe(false);
      }
    }
  });
});
