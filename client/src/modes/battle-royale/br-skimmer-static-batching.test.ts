import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createBrHoverSkimmer, disposeBrHoverSkimmer, updateBrHoverSkimmer } from "./br-hover-skimmer";
import { batchBrSkimmerStaticParts } from "./br-skimmer-static-batching";

describe("exact static skimmer instancing", () => {
  it("preserves all rendered vertices, normals, UVs and material policies through animated root motion", () => {
    const visual = createBrHoverSkimmer();
    const batches: THREE.InstancedMesh[] = [];
    visual.group.traverse(object => { if (object instanceof THREE.InstancedMesh) batches.push(object); });
    expect(batches.length).toBeGreaterThan(0);
    const instance = new THREE.Matrix4(), world = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), sourceNormalMatrix = new THREE.Matrix3();
    for (const time of [0, .8, 2.5]) {
      updateBrHoverSkimmer(visual, { time, speed: 11, steering: .6, occupied: true });
      visual.group.position.set(43, 6, -29); visual.group.rotation.y = 1.2; visual.group.updateMatrixWorld(true);
      for (const batch of batches) for (let i = 0; i < batch.count; i++) {
        const source = visual.group.getObjectByProperty("uuid", batch.userData.sourceUuids[i]) as THREE.Mesh;
        expect(source.visible).toBe(false); expect(source.parent).toBe(batch.parent);
        expect(batch.material).toBe(source.material); expect(batch.castShadow).toBe(source.castShadow); expect(batch.receiveShadow).toBe(source.receiveShadow);
        expect(batch.renderOrder).toBe(source.renderOrder); expect(batch.layers.mask).toBe(source.layers.mask);
        batch.getMatrixAt(i, instance); world.multiplyMatrices(batch.matrixWorld, instance);
        normalMatrix.getNormalMatrix(world); sourceNormalMatrix.getNormalMatrix(source.matrixWorld);
        const a = batch.geometry.getAttribute("position"), b = source.geometry.getAttribute("position");
        const an = batch.geometry.getAttribute("normal"), bn = source.geometry.getAttribute("normal");
        const auv = batch.geometry.getAttribute("uv"), buv = source.geometry.getAttribute("uv");
        expect(a.count).toBe(b.count);
        expect(Array.from(batch.geometry.index?.array ?? [])).toEqual(Array.from(source.geometry.index?.array ?? []));
        for (let v = 0; v < a.count; v++) {
          const actual = new THREE.Vector3().fromBufferAttribute(a, v).applyMatrix4(world);
          const expected = new THREE.Vector3().fromBufferAttribute(b, v).applyMatrix4(source.matrixWorld);
          expect(actual.distanceTo(expected)).toBeLessThan(.000001);
          const actualNormal = new THREE.Vector3().fromBufferAttribute(an, v).applyNormalMatrix(normalMatrix);
          const expectedNormal = new THREE.Vector3().fromBufferAttribute(bn, v).applyNormalMatrix(sourceNormalMatrix);
          expect(actualNormal.distanceTo(expectedNormal)).toBeLessThan(.000001);
          expect(auv.getX(v)).toBe(buv.getX(v)); expect(auv.getY(v)).toBe(buv.getY(v));
        }
      }
    }
    disposeBrHoverSkimmer(visual);
  });
  it("reduces draw objects without hiding the glass, lights, pods or anchors and releases instance buffers once", () => {
    const visual = createBrHoverSkimmer();
    const original: THREE.Mesh[] = [], rendered: THREE.Mesh[] = [], batches: THREE.InstancedMesh[] = [];
    visual.group.traverse(object => { if (object instanceof THREE.InstancedMesh) batches.push(object); else if (object instanceof THREE.Mesh) original.push(object); });
    visual.group.traverseVisible(object => { if (object instanceof THREE.Mesh) rendered.push(object); });
    expect(original).toHaveLength(37);
    expect(rendered).toHaveLength(27);
    expect(visual.resources.geometries.length).toBeLessThanOrEqual(18);
    expect(visual.group.getObjectByName("skimmer-windscreen")!.visible).toBe(true);
    expect([...visual.headLights, ...visual.tailLights].every(light => light.visible && light.parent === visual.model)).toBe(true);
    expect(visual.hoverModules.every(pod => pod.parent === visual.model && pod.children.every(child => child.visible))).toBe(true);
    expect(visual.driverAnchor.parent).toBe(visual.model); expect(visual.seatAnchor.parent).toBe(visual.model);
    const spies = [...batches, ...visual.resources.geometries, ...visual.resources.materials].map(resource => vi.spyOn(resource, "dispose"));
    disposeBrHoverSkimmer(visual); disposeBrHoverSkimmer(visual);
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
  });
  it("separates shadow and render policies and excludes animated/transparent parts", () => {
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    const parts = Array.from({ length: 6 }, () => new THREE.Mesh(geometry, material)); root.add(...parts);
    parts[2].castShadow = true; parts[3].renderOrder = 4;
    const glass = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: .8 })); root.add(glass);
    const batches = batchBrSkimmerStaticParts(root, new Set([parts[4], parts[5]]));
    expect(batches).toHaveLength(1); expect(batches[0].count).toBe(2);
    expect([parts[2], parts[3], parts[4], parts[5], glass].every(mesh => mesh.visible)).toBe(true);
    batches.forEach(batch => batch.dispose()); geometry.dispose(); material.dispose(); glass.material.dispose();
  });
});

