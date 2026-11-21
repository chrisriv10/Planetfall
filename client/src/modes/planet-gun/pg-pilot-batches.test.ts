import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createAstronautVisual } from "../../astronaut";
import { createPgPilotBatches } from "./pg-pilot-batches";
import { BrWeaponModelLibrary } from "../battle-royale/br-weapon-model-library";
import { PG_HERO_IDS } from "@planetfall/shared";
import { createPgCharacterArt } from "./pg-character-art";

function pilot() { return createAstronautVisual({ identityColor: "#ffb45c", suitAccent: "#aabbcc", isBot: true }); }
function instanceCount(pool: ReturnType<typeof createPgPilotBatches>) {
  return pool.group.children.reduce((n, o) => n + (o instanceof THREE.InstancedMesh ? o.count : 0), 0);
}
describe("canonical PlanetGun pilot batching", () => {
  it("renders all Watch heroes on both teams and removes dead/replaced rig matrices", () => {
    const pool = createPgPilotBatches();
    const rigs = ["#ffb45c", "#5ae1f0"].flatMap(team => PG_HERO_IDS.map(id => {
      const rig = createAstronautVisual({ identityColor: team, suitAccent: team, isBot: true });
      return { rig, art: createPgCharacterArt(rig, id), id };
    }));
    expect(rigs).toHaveLength(12);
    let expectedInstances = 0, expectedIndividual = 0;
    rigs.forEach(({ rig }, i) => {
      rig.group.position.x = i * 20; rig.leftArm.rotation.x = .2 * i;
      rig.group.updateMatrixWorld(true);
      const result = pool.register(rig.group); expect(result.accepted).toBe(true);
      expectedInstances += result.batched; expectedIndividual += result.individual;
      pool.submit(rig.group);
    });
    pool.flush();
    expect(instanceCount(pool)).toBe(expectedInstances);
    expect(pool.group.children.filter(o => !(o instanceof THREE.InstancedMesh) && o.visible)).toHaveLength(expectedIndividual);
    const actual = new THREE.Matrix4();
    // Check actual colored armor and each hero's silhouette, not just registration.
    for (const { rig, id } of rigs) {
      const identity = rig.group.getObjectByName(`pg-identity-${id}`) as THREE.Mesh;
      expect(identity).toBeDefined();
      for (const source of [rig.torso, identity]) {
        const positions = Array.from(source.geometry.getAttribute("position").array);
        const matching = pool.group.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh
          && !Array.isArray(o.material) && !Array.isArray(source.material)
          && (o.material as THREE.MeshStandardMaterial).color.equals((source.material as THREE.MeshStandardMaterial).color)
          && o.geometry.getAttribute("position").array.length === positions.length
          && positions.every((v, i) => v === o.geometry.getAttribute("position").array[i]));
        expect(matching.some(mesh => {
          if (!(mesh instanceof THREE.InstancedMesh)) return mesh.visible && mesh.matrix.equals(source.matrixWorld);
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, actual);
            if (actual.elements.every((v, j) => Math.abs(v - source.matrixWorld.elements[j]!) < 1e-5)) return true;
          }
          return false;
        }), `${id} armor/identity matrix`).toBe(true);
      }
    }
    // An unsubmitted dead pilot contributes neither old matrices nor proxies.
    for (const { rig } of rigs.slice(1)) pool.submit(rig.group);
    pool.flush();
    function expectNoDeadMatrices() {
      for (const o of pool.group.children) if (o instanceof THREE.Mesh) {
        if (o instanceof THREE.InstancedMesh) for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, actual); expect(actual.elements[12]).toBeGreaterThan(10);
        }
        else if (o.visible) expect(o.matrix.elements[12]).toBeGreaterThan(10);
      }
    }
    expectNoDeadMatrices();
    pool.unregister(rigs[0]!.rig.group);
    const replacement = createAstronautVisual({ identityColor: "#5ae1f0", suitAccent: "#5ae1f0", isBot: false });
    const replacementArt = createPgCharacterArt(replacement, "solace");
    replacement.group.position.x = 500; replacement.group.updateMatrixWorld(true);
    expect(pool.register(replacement.group).accepted).toBe(true);
    for (const { rig } of rigs.slice(1)) pool.submit(rig.group);
    pool.submit(replacement.group); pool.flush(); expectNoDeadMatrices();
    const disposals = pool.group.children.flatMap(o => o instanceof THREE.Mesh
      ? [vi.spyOn(o.geometry, "dispose"), ...[o.material].flat().map(m => vi.spyOn(m, "dispose"))] : []);
    pool.dispose(); pool.dispose(); expect(pool.group.children).toHaveLength(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    for (const { art } of rigs) art.dispose(); replacementArt.dispose();
  });
  it("verifies exact bytes on fingerprint collisions and releases colliding batches independently", () => {
    const pool = createPgPilotBatches(), material = new THREE.MeshBasicMaterial();
    // Both byte arrays have FNV-1a fingerprint 907280229.
    const arrays = [[16, 198, 154, 146, 156, 197, 35, 166], [5, 139, 37, 161, 141, 253, 183, 45]];
    const roots = arrays.map(bytes => {
      const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Uint8Array(bytes), 2));
      const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, material)); pool.register(root); return root;
    });
    expect(pool.group.children).toHaveLength(2);
    const first = pool.group.children[0] as THREE.Mesh, second = pool.group.children[1] as THREE.Mesh;
    const release = vi.spyOn(first.geometry, "dispose");
    pool.unregister(roots[0]!); expect(release).toHaveBeenCalledTimes(1);
    expect(pool.group.children).toEqual([second]);
    const replacement = roots[1]!.clone(); pool.register(replacement);
    expect(pool.group.children).toHaveLength(1);
    pool.dispose(); expect(release).toHaveBeenCalledTimes(1);
  });
  it("keeps attribute layout, index type, groups, draw range and GPU attribute type distinct", () => {
    const pool = createPgPilotBatches(), base = new THREE.BoxGeometry();
    const variants = [base, base.clone(), base.clone(), base.clone(), base.clone(), base.clone(), base.clone()];
    (variants[1]!.getAttribute("position") as THREE.BufferAttribute).normalized = true;
    (variants[2]!.getAttribute("position") as THREE.BufferAttribute).itemSize = 1;
    variants[3]!.setIndex(new THREE.BufferAttribute(new Uint32Array(base.index!.array), 1));
    variants[4]!.clearGroups(); variants[5]!.setDrawRange(3, 9);
    (variants[6]!.getAttribute("position") as THREE.BufferAttribute).gpuType = THREE.IntType;
    for (const geometry of variants) { const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())); pool.register(root); }
    expect(pool.group.children).toHaveLength(variants.length); pool.dispose();
  });
  it("observes mutable geometry and material changes on later registrations without version bumps", () => {
    const pool = createPgPilotBatches(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    const a = new THREE.Group(), b = new THREE.Group(); a.add(new THREE.Mesh(geometry, material)); b.add(new THREE.Mesh(geometry, material));
    pool.register(a); pool.register(b); expect(pool.group.children).toHaveLength(1);
    material.color.set(0xff2244); material.roughness = .23; material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 2)];
    pool.register(b); expect(pool.group.children).toHaveLength(2);
    const changed = (pool.group.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(changed.color.getHex()).toBe(0xff2244); expect(changed.roughness).toBe(.23); expect(changed.clippingPlanes![0]!.constant).toBe(2);
    const c = b.clone(); pool.register(c); expect(pool.group.children).toHaveLength(2);
    geometry.getAttribute("position").setX(0, 17); pool.register(c); expect(pool.group.children).toHaveLength(3);
    expect((pool.group.children[2] as THREE.Mesh).geometry.getAttribute("position").getX(0)).toBe(17);
    pool.dispose();
  });
  it("serializes a shared material once per registration, preserving white instance colors", () => {
    const pool = createPgPilotBatches(), material = new THREE.MeshBasicMaterial(), root = new THREE.Group(), geometry = new THREE.BoxGeometry();
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const serialize = vi.spyOn(material, "toJSON"); pool.register(root); expect(serialize).toHaveBeenCalledTimes(1);
    const batch = pool.group.children[0] as THREE.InstancedMesh;
    expect(Array.from(batch.instanceColor!.array).every(value => value === 1)).toBe(true);
    pool.register(root); expect(serialize).toHaveBeenCalledTimes(2); pool.dispose();
  });
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
