import { describe, expect, it } from "vitest";
import { Box3, Euler, Matrix4, Vector3 } from "three";
import { BR_STRUCTURES, BR_ROADS, BR_MAP_BLOCKS, BR_LOOT_SOCKETS, BR_CRATE_SOCKETS, BR_POIS, BR_ISLAND_OUTLINE, brAuthoredDeckHeight } from "@planetfall/shared";
import { BR_CONTEXT_VEHICLE_BOUNDS, brContextVehicleFootprint, buildBrContextVehiclePlacements } from "./br-context-placements";
import { buildBrAuthoredDistrictProps } from "./br-authored-district-props";
import { buildBrNovaStreetscape } from "./br-nova-streetscape";

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
function overlaps(a: Rect, b: Rect, margin = 0) {
  return a.maxX + margin > b.minX && a.minX - margin < b.maxX && a.maxZ + margin > b.minZ && a.minZ - margin < b.maxZ;
}
function rectangle(x: number, z: number, hx: number, hz: number): Rect {
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}
function distanceToSegment(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}

describe("authored contextual vehicle placements", () => {
  it("clears authored prop pockets, full tree canopies, and every other vehicle", () => {
    const vehicles = buildBrContextVehiclePlacements();
    const pockets = [...BR_POIS.flatMap(buildBrAuthoredDistrictProps), ...buildBrNovaStreetscape("high")];
    for (const vehicle of vehicles) {
      const footprint = brContextVehicleFootprint(vehicle);
      for (const pocket of pockets) {
        // Test the entire reserved pocket, including soil under hovering bodies.
        const dx = Math.max(footprint.minX - pocket.center.x, 0, pocket.center.x - footprint.maxX);
        const dz = Math.max(footprint.minZ - pocket.center.z, 0, pocket.center.z - footprint.maxZ);
        expect(Math.hypot(dx, dz), `${vehicle.id} / ${pocket.id} reserved pocket`).toBeGreaterThanOrEqual(pocket.radius + .5);
        for (const part of pocket.parts) {
          // Octahedra/cylinders have radius 1: scale is NOT a box diameter.
          // Project the full conservative canopy bounds through its authored yaw.
          const factor = part.geometry === "box" ? .5 : 1;
          const hx = part.scale.x * factor, hz = part.scale.z * factor;
          const c = Math.abs(Math.cos(part.rotationY)), s = Math.abs(Math.sin(part.rotationY));
          const bounds = rectangle(part.position.x, part.position.z, c * hx + s * hz, s * hx + c * hz);
          expect(overlaps(footprint, bounds, .5), `${vehicle.id} / ${pocket.id} ${part.finish}`).toBe(false);
        }
      }
      for (const other of vehicles.filter(other => other.id !== vehicle.id)) {
        expect(overlaps(footprint, brContextVehicleFootprint(other), 1), `${vehicle.id} / ${other.id}`).toBe(false);
      }
    }
  });

  it("returns six deterministic, independently owned transforms", () => {
    const a = buildBrContextVehiclePlacements(), b = buildBrContextVehiclePlacements();
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(new Set(a.map(p => p.id)).size).toBe(6);
    a[0].position.y = 900;
    expect(buildBrContextVehiclePlacements()).toEqual(b);
    for (const p of b) expect(p.purpose.length).toBeGreaterThan(20);
  });

  it("includes capsule tips and outboard rails/skids, not just chassis dimensions", () => {
    expect(BR_CONTEXT_VEHICLE_BOUNDS["hover-taxi"].halfX * 2).toBe(3.8 + 2 * 1.25);
    expect(BR_CONTEXT_VEHICLE_BOUNDS["hover-taxi"].halfZ).toBe(1.25 + .45 / 2);
    expect(BR_CONTEXT_VEHICLE_BOUNDS["cargo-mover"].halfZ).toBe(1.56 + .3 / 2);
    expect(BR_CONTEXT_VEHICLE_BOUNDS["maintenance-rover"].halfZ).toBeCloseTo(1.42 + .36 / 2, 10);
    for (const p of buildBrContextVehiclePlacements()) {
      const b = BR_CONTEXT_VEHICLE_BOUNDS[p.kind], rect = brContextVehicleFootprint(p);
      for (const x of [-b.halfX, b.halfX]) for (const z of [-b.halfZ, b.halfZ]) {
        const corner = new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), p.rotationY).add(new Vector3(p.position.x, 0, p.position.z));
        expect(corner.x).toBeGreaterThanOrEqual(rect.minX - 1e-9);
        expect(corner.x).toBeLessThanOrEqual(rect.maxX + 1e-9);
        expect(corner.z).toBeGreaterThanOrEqual(rect.minZ - 1e-9);
        expect(corner.z).toBeLessThanOrEqual(rect.maxZ + 1e-9);
      }
    }
  });

  it("supports the full footprint on a single deck and respects hover/skid contact", () => {
    for (const p of buildBrContextVehiclePlacements()) {
      const r = brContextVehicleFootprint(p), b = BR_CONTEXT_VEHICLE_BOUNDS[p.kind];
      for (const x of [r.minX, p.position.x, r.maxX]) for (const z of [r.minZ, p.position.z, r.maxZ]) {
        expect(brAuthoredDeckHeight({ x, z }), p.id).toBe(p.groundHeight);
        let inside = false;
        for (let i = 0, j = BR_ISLAND_OUTLINE.length - 1; i < BR_ISLAND_OUTLINE.length; j = i++) {
          const [ax, az] = BR_ISLAND_OUTLINE[i], [bx, bz] = BR_ISLAND_OUTLINE[j];
          if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
        }
        expect(inside, `${p.id} supported by island deck`).toBe(true);
      }
      expect(p.position.y + b.minY - p.groundHeight).toBeCloseTo(b.groundGap, 8);
    }
  });

  it("clears complete structures and their 8m entrance approaches", () => {
    for (const p of buildBrContextVehiclePlacements()) for (const s of BR_STRUCTURES) {
      const r = brContextVehicleFootprint(p);
      expect(overlaps(r, rectangle(s.position.x, s.position.z, s.size.x / 2, s.size.z / 2), .5), `${p.id} / ${s.id}`).toBe(false);
      const eastWest = s.entrance === "east" || s.entrance === "west";
      const sign = s.entrance === "north" || s.entrance === "east" ? 1 : -1;
      const x = s.position.x + (eastWest ? sign * (s.size.x / 2 + 4) : 0);
      const z = s.position.z + (eastWest ? 0 : sign * (s.size.z / 2 + 4));
      expect(overlaps(r, rectangle(x, z, eastWest ? 4 : 3.4, eastWest ? 3.4 : 4), .35), `${p.id} / ${s.id} entrance`).toBe(false);
    }
  });

  it("keeps full bodies off drivable corridors, loot sockets and authored obstacles", () => {
    for (const p of buildBrContextVehiclePlacements()) {
      const r = brContextVehicleFootprint(p), b = BR_CONTEXT_VEHICLE_BOUNDS[p.kind];
      for (const road of BR_ROADS) expect(distanceToSegment(p.position, road.from, road.to) - Math.hypot(b.halfX, b.halfZ), `${p.id} / ${road.id}`).toBeGreaterThanOrEqual(road.width / 2 + .5);
      const sockets = [...BR_LOOT_SOCKETS.map(s => s.position), ...BR_CRATE_SOCKETS, ...BR_POIS.flatMap(s => s.lootPoints)];
      for (const socket of sockets) expect(overlaps(r, rectangle(socket.x, socket.z, 1.5, 1.5)), `${p.id} / socket ${socket.x},${socket.z}`).toBe(false);
      for (const block of BR_MAP_BLOCKS.filter(b => b.kind !== "platform" && b.kind !== "bridge")) {
        const half = new Vector3(block.size.x / 2, block.size.y / 2, block.size.z / 2);
        const box = new Box3(half.clone().negate(), half.clone()).applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(block.rotation?.x ?? 0, block.rotation?.y ?? 0, block.rotation?.z ?? 0))).translate(new Vector3(block.position.x, block.position.y, block.position.z));
        if (box.max.y <= p.groundHeight || box.min.y >= p.position.y + b.maxY) continue;
        expect(overlaps(r, { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }, .35), `${p.id} / ${block.id}`).toBe(false);
      }
    }
  });
});
