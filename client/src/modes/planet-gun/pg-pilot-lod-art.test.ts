import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createPgPilotLodArt, PG_PILOT_LOD_CAPACITY, type PgPilotLodPose } from "./pg-pilot-lod-art";

const pose: PgPilotLodPose = {
  rootPosition: { x: 2, y: .25, z: 4 }, yaw: 0,
  velocity: { x: 0, y: 0, z: 0 }, grounded: true, crouched: false,
  team: "solar", suitColor: "#ff0066", weapon: "rail", timeSeconds: 1,
};
function meshes(pool: ReturnType<typeof createPgPilotLodArt>) { return pool.group.children as THREE.InstancedMesh[]; }
function position(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}
describe("PlanetGun distant canonical pilot art", () => {
  it("represents twelve pilots in six fixed batches without shadows", () => {
    const pool = createPgPilotLodArt();
    for (let i = 0; i < PG_PILOT_LOD_CAPACITY; i++) expect(pool.update(i, pose)).toBe(true);
    pool.flush(100);
    expect(meshes(pool)).toHaveLength(6);
    expect(meshes(pool).map(m => m.count)).toEqual([12, 60, 48, 12, 48, 36]);
    expect(meshes(pool).every(m => !m.castShadow && !m.receiveShadow)).toBe(true);
    expect(pool.update(12, pose)).toBe(false);
    pool.dispose();
  });
  it("preserves canonical helmet placement and lowers crouching silhouettes", () => {
    const pool = createPgPilotLodArt(); pool.update(0, pose);
    const helmet = position(meshes(pool)[1]!, 0);
    expect(helmet.y).toBeCloseTo(.25 + 1.46 * .85);
    pool.update(0, { ...pose, crouched: true });
    expect(position(meshes(pool)[1]!, 0).y).toBeCloseTo(helmet.y - .28 * .85);
    pool.dispose();
  });
  it("turns the visor and weapon together and retains suit and team identity", () => {
    const pool = createPgPilotLodArt(); pool.update(0, pose);
    expect(position(meshes(pool)[3]!, 0).z).toBeLessThan(pose.rootPosition.z);
    expect(position(meshes(pool)[5]!, 1).z).toBeLessThan(pose.rootPosition.z);
    pool.update(0, { ...pose, yaw: Math.PI / 2 });
    expect(position(meshes(pool)[3]!, 0).x).toBeLessThan(pose.rootPosition.x);
    const color = new THREE.Color(); meshes(pool)[4]!.getColorAt(0, color);
    expect(color.getHexString()).toBe("ff0066");
    meshes(pool)[4]!.getColorAt(1, color); expect(color.getHexString()).toBe("ffb45c");
    pool.dispose();
  });
  it("keeps crouched boots above the floor at the canonical .04 root offset", () => {
    const pool = createPgPilotLodArt();
    pool.update(0, { ...pose, rootPosition: { x: 0, y: .04, z: 0 }, crouched: true });
    expect(position(meshes(pool)[1]!, 1).y - .173 * .85).toBeGreaterThanOrEqual(0);
    expect(position(meshes(pool)[1]!, 2).y - .173 * .85).toBeGreaterThanOrEqual(0);
    pool.dispose();
  });
  it("reuses storage and hides malformed input without nonfinite transforms", () => {
    const pool = createPgPilotLodArt();
    const arrays = meshes(pool).map(m => m.instanceMatrix.array);
    pool.update(0, pose); pool.flush(1);
    expect(pool.update(0, { ...pose, rootPosition: { x: NaN, y: 0, z: 0 } })).toBe(false);
    for (const mesh of meshes(pool)) expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    pool.clear(); expect(meshes(pool).every(m => m.count === 0)).toBe(true);
    pool.update(0, { ...pose, grounded: false }); pool.flush(1);
    meshes(pool).forEach((mesh, i) => expect(mesh.instanceMatrix.array).toBe(arrays[i]));
    pool.dispose();
  });
  it("disposes each owned shared resource exactly once", () => {
    const pool = createPgPilotLodArt();
    const resources = new Set<{ dispose(): void }>();
    for (const mesh of meshes(pool)) { resources.add(mesh); resources.add(mesh.geometry); resources.add(mesh.material as THREE.Material); }
    const spies = [...resources].map(resource => vi.spyOn(resource, "dispose"));
    pool.dispose(); pool.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(pool.update(0, pose)).toBe(false); expect(pool.group.children).toHaveLength(0);
  });
});
