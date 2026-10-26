import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createAstronautVisual } from "../../astronaut";
import { createPgPilotBatches } from "./pg-pilot-batches";
import { BrWeaponModelLibrary } from "../battle-royale/br-weapon-model-library";

function pilot() { return createAstronautVisual({ identityColor: "#ffb45c", suitAccent: "#aabbcc", isBot: true }); }
function instanceCount(pool: ReturnType<typeof createPgPilotBatches>) {
  return pool.group.children.reduce((n, o) => n + (o instanceof THREE.InstancedMesh ? o.count : 0), 0);
}
describe("canonical PlanetGun pilot batching", () => {
  it("bounds eleven canonical armed pilots while preserving live crouched matrices", () => {
    const pool = createPgPilotBatches(), library = new BrWeaponModelLibrary();
    let originalDraws = 0;
    const rigs = Array.from({ length: 11 }, (_, i) => {
      const rig = pilot();
      rig.group.add(library.create(i % 2 ? "rail-laser" : "pulse-rifle", 0x8ee8d9));
      rig.group.position.set(i * 2, .04, 0); rig.group.scale.setScalar(.85);
      rig.upperBody.position.y = -.22; rig.leftLeg.rotation.x = .6;
      rig.group.updateMatrixWorld(true);
      rig.group.traverse(o => { if (o instanceof THREE.Mesh) originalDraws++; });
      expect(pool.register(rig.group).accepted).toBe(true); pool.submit(rig.group); return rig;
    });
    pool.flush();
    const calls = pool.group.children.filter(o => o.visible && (!(o instanceof THREE.InstancedMesh) || o.count > 0)).length;
    let bytes = 0;
    for (const o of pool.group.children) if (o instanceof THREE.Mesh) {
      for (const a of Object.values(o.geometry.attributes)) if (a instanceof THREE.BufferAttribute) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof THREE.InstancedMesh) bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
    }
    expect(calls).toBeLessThan(originalDraws / 3);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
    // Exact live canonical torso matrix is present, including crouch transform.
    const target = rigs[0]!.torso.matrixWorld, actual = new THREE.Matrix4(); let found = false;
    for (const o of pool.group.children) if (o instanceof THREE.InstancedMesh) for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, actual);
      if (actual.elements.every((v, j) => Math.abs(v - target.elements[j]!) < 1e-6)) found = true;
    }
    expect(found).toBe(true);
    console.info(`Canonical eleven armed pilots: ${originalDraws} original draws -> ${calls} draws; ${bytes} owned geometry/instance bytes`);
    pool.dispose(); library.dispose();
  });
  it("combines separately constructed canonical rigs without simplifying geometry", () => {
    const pool = createPgPilotBatches(), a = pilot(), b = pilot();
    const first = pool.register(a.group); const calls = pool.group.children.length;
    const second = pool.register(b.group);
    expect(first.accepted).toBe(true); expect(second.accepted).toBe(true);
    expect(pool.group.children.length).toBe(calls);
    a.group.updateMatrixWorld(true); b.group.position.x = 4; b.group.updateMatrixWorld(true);
    a.group.visible = false; b.group.visible = false;
    pool.submit(a.group); pool.submit(b.group); pool.flush();
    expect(instanceCount(pool)).toBe(first.batched + second.batched);
    expect(calls).toBeLessThan(first.batched);
    const masked = pool.group.children.find(o => o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material.customProgramCacheKey().includes("astronaut-visor-cap-mask-v1")) as THREE.Mesh;
    expect(masked).toBeDefined();
    expect(masked.geometry.attributes.position!.count).toBe(a.visor.geometry.attributes.position!.count);
    expect((masked.material as THREE.Material).onBeforeCompile).toBe(a.visor.material.onBeforeCompile);
    pool.dispose();
  });
  it("copies moving eye instances and bone world transforms, respecting child visibility", () => {
    const pool = createPgPilotBatches(), root = new THREE.Group(), bone = new THREE.Group(); root.add(bone);
    const eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(.08), new THREE.MeshBasicMaterial({ color: 0 }), 2);
    bone.add(eyes); eyes.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-.2, 1, 0)); eyes.setMatrixAt(1, new THREE.Matrix4().makeTranslation(.2, 1, 0));
    pool.register(root); root.position.x = 3; bone.position.y = 2; root.updateMatrixWorld(true);
    pool.submit(root); pool.submit(root); pool.flush();
    const batch = pool.group.children[0] as THREE.InstancedMesh, matrix = new THREE.Matrix4();
    expect(batch.count).toBe(2); batch.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([expect.closeTo(2.8), 3, 0]);
    bone.visible = false; pool.submit(root); pool.flush(); expect(batch.count).toBe(0);
    pool.dispose();
  });
  it("keeps transparent and multi-material parts individually sorted and owns their resources", () => {
    const pool = createPgPilotBatches(), root = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: .72 }));
    const grouped = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    root.add(glass, grouped); const result = pool.register(root);
    expect(result.individual).toBe(2); root.position.z = 8; root.updateMatrixWorld(true);
    pool.submit(root); pool.flush(); const proxy = pool.group.children[0] as THREE.Mesh;
    expect(proxy.visible).toBe(true); expect(proxy.geometry).not.toBe(glass.geometry); expect(proxy.material).not.toBe(glass.material);
    expect((proxy.material as THREE.MeshBasicMaterial).opacity).toBe(.72);
    expect(proxy.matrix.elements[14]).toBe(8);
    pool.flush(); expect(proxy.visible).toBe(false); pool.dispose();
  });
  it("keeps shared batch resources alive when one source leaves and releases them once", () => {
    const pool = createPgPilotBatches(), a = pilot(), b = pilot(); pool.register(a.group); pool.register(b.group);
    const batch = pool.group.children[0] as THREE.InstancedMesh;
    const geometryDispose = vi.spyOn(batch.geometry, "dispose"), materialDispose = vi.spyOn(batch.material as THREE.Material, "dispose");
    pool.unregister(a.group); expect(geometryDispose).not.toHaveBeenCalled();
    b.group.updateMatrixWorld(true); pool.submit(b.group); pool.flush(); expect(instanceCount(pool)).toBeGreaterThan(0);
    pool.unregister(b.group); expect(pool.group.children).toHaveLength(0);
    pool.dispose(); pool.dispose(); expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported morphs without replacing existing registration", () => {
    const pool = createPgPilotBatches(), rig = pilot(); expect(pool.register(rig.group).accepted).toBe(true);
    rig.torso.morphTargetInfluences = [1];
    expect(pool.register(rig.group)).toMatchObject({ accepted: false, reason: "skinned/morph geometry requires original rendering" });
    pool.dispose();
  });
});
