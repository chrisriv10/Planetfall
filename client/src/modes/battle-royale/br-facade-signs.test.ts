import { describe, expect, it } from "vitest";
import { Box3, Euler, Matrix4, Vector3 } from "three";
import { BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_SECONDARY_LOCATIONS, BR_STRUCTURES, type BrStructure } from "@planetfall/shared";
import { BR_PRIMARY_FACADE_SIGN_TEXT, buildBrFacadeSign, buildBrFacadeSignCatalog, brFacadeSignOmission, getBrFacadeSignText } from "./br-facade-signs";
import { buildBrFacadeSkin } from "./br-facade-skin";
import { buildBrDoorwayParts } from "./br-facade-attachments";
import { buildBrRooftopDetails } from "./br-rooftop-details";

const namedMajorIds = Object.keys(BR_PRIMARY_FACADE_SIGN_TEXT);
const named = BR_STRUCTURES.filter(s => namedMajorIds.includes(s.id) || BR_SECONDARY_LOCATIONS.some(l => l.id === s.districtId && s.id === `${l.id}-1`));
const mounted = named.filter(s => !brFacadeSignOmission(s));
const box = (position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }) => new Box3().setFromCenterAndSize(new Vector3(position.x, position.y, position.z), new Vector3(scale.x, scale.y, scale.z));
const synthetic = (entrance: BrStructure["entrance"], height: number): BrStructure => ({ ...BR_STRUCTURES.find(s => s.id === "nova-cafe")!, id: "short-shop", position: { x: 12, y: 5, z: 23 }, size: { x: 18, y: height, z: 18 }, floors: 1, entrance });

describe("supported facade roof crests", () => {
  it("covers the named production catalog with bounded deterministic nonmutating parts", () => {
    expect(named.length).toBeGreaterThan(30);
    const catalog = buildBrFacadeSignCatalog();
    expect(catalog).toHaveLength(named.length);
    expect(catalog.filter(entry => entry.omission === null).length).toBe(mounted.length);
    for (const s of named.filter(s => brFacadeSignOmission(s))) {
      expect(getBrFacadeSignText(s)).not.toBeNull();
      expect(buildBrFacadeSign(s, s.id)).toBeNull();
    }
    for (const s of mounted) {
      const original = structuredClone(s), a = buildBrFacadeSign(s, s.id)!, b = buildBrFacadeSign(s, s.id)!;
      expect(a).not.toBeNull();
      expect(a).toEqual(b);
      expect(s).toEqual(original);
      expect(a.parts).toHaveLength(7);
      expect(a.label.width).toBeLessThanOrEqual(8.5);
      expect(a.label.width).toBeGreaterThanOrEqual(4);
      expect(a.label.height).toBe(1.2);
      a.parts[0].position.y = 900;
      expect(buildBrFacadeSign(s, s.id)).toEqual(b);
    }
    expect(buildBrFacadeSign(named[0], " ")).toBeNull();
  });

  it("faces outward and remains beyond the full doorway for every orientation and short roof", () => {
    for (const entrance of ["north", "south", "east", "west"] as const) for (const height of [3, 4, 6]) {
      const s = synthetic(entrance, height), result = buildBrFacadeSign(s, "SHOP")!;
      const ns = entrance === "north" || entrance === "south", along = ns ? "x" : "z", normal = ns ? "z" : "x";
      const sign = entrance === "north" || entrance === "east" ? 1 : -1;
      const forward = new Vector3(Math.sin(result.label.rotationY), 0, Math.cos(result.label.rotationY));
      expect(forward[normal]).toBeCloseTo(sign);
      expect(result.label.position[along] + result.label.width / 2).toBeLessThan(s.position[along] - 3.2);
      for (const p of result.parts) {
        expect(p.position[along] + p.scale[along] / 2).toBeLessThan(s.position[along] - 2.4);
        expect(p.position.y - p.scale.y / 2).toBeGreaterThan(s.position.y + s.size.y);
      }
      // The feet reach across the real wall cap; the rest never becomes an
      // opaque obstacle in the playable room or above the roof-ramp outlet.
      for (const foot of result.parts.filter(p => p.name === "cap-foot")) {
        const offset = (foot.position[normal] - s.position[normal]) * sign - s.size[normal] / 2;
        expect(offset - foot.scale[normal] / 2).toBeLessThan(0);
        expect(offset + foot.scale[normal] / 2).toBeGreaterThan(.7);
      }
    }
  });

  it("clears production glass, trim, doorway hardware and inspectable rooftop details", () => {
    const examples = [...mounted, ...(["north", "south", "east", "west"] as const).flatMap(face => [3, 4].map(h => synthetic(face, h)))];
    for (const s of examples) {
      const result = buildBrFacadeSign(s, s.id)!;
      const roofLoot = BR_LOOT_SOCKETS.find(l => l.structureId === s.id && l.kind === "roof");
      const parts = [...buildBrFacadeSkin(s), ...buildBrDoorwayParts(s), ...buildBrRooftopDetails(s, roofLoot)];
      for (const mounting of result.parts) for (const p of parts) {
        const bounds = box({ ...p.position, y: p.position.y + s.position.y }, p.scale);
        expect(box(mounting.position, mounting.scale).intersectsBox(bounds), `${s.id} ${mounting.name} / ${p.finish}`).toBe(false);
      }
    }
  });

  it("does not intersect neighboring authoritative building volumes", () => {
    for (const s of mounted) for (const p of buildBrFacadeSign(s, s.id)!.parts) for (const other of BR_STRUCTURES) {
      if (other.id === s.id) continue;
      const body = box({ ...other.position, y: other.position.y + other.size.y / 2 }, other.size);
      expect(box(p.position, p.scale).intersectsBox(body), `${s.id} / ${other.id}`).toBe(false);
    }
  });

  it("preserves roof loot pockets and the actual rotated roof-access ramps", () => {
    for (const s of mounted) {
      const sign = buildBrFacadeSign(s, s.id)!;
      for (const p of sign.parts) {
        const bounds = box(p.position, p.scale);
        for (const loot of BR_LOOT_SOCKETS.filter(l => l.structureId === s.id && l.kind === "roof")) {
          const dx = Math.max(bounds.min.x - loot.position.x, 0, loot.position.x - bounds.max.x);
          const dz = Math.max(bounds.min.z - loot.position.z, 0, loot.position.z - bounds.max.z);
          expect(Math.hypot(dx, dz), `${s.id} / roof loot`).toBeGreaterThan(1.5);
        }
        for (const ramp of BR_MAP_BLOCKS.filter(b => b.id === `${s.id}-roof-ramp`)) {
          const rampBounds = box({ x: 0, y: 0, z: 0 }, ramp.size)
            .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(ramp.rotation?.x ?? 0, ramp.rotation?.y ?? 0, ramp.rotation?.z ?? 0)))
            .translate(new Vector3(ramp.position.x, ramp.position.y, ramp.position.z));
          expect(bounds.intersectsBox(rampBounds), `${s.id} / ramp`).toBe(false);
        }
      }
    }
  });
});
