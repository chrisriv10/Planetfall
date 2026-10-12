import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createBrHoverSkimmer, disposeBrHoverSkimmer, updateBrHoverSkimmer } from "./br-hover-skimmer";
import { createBrSkimmerDistanceLod } from "./br-skimmer-distance-lod";

const draws = (root: THREE.Object3D) => { let count = 0; root.traverseVisible(o => { if (o instanceof THREE.Mesh) count++; }); return count; };
describe("borrowed skimmer distance LOD", () => {
  it("reduces 27 draws to ten while preserving canonical resources, anchors and near membership", () => {
    const visual = createBrHoverSkimmer(), children = [...visual.model.children];
    const geometries = [...visual.resources.geometries], materials = [...visual.resources.materials];
    const lod = createBrSkimmerDistanceLod(visual);
    expect(draws(visual.group)).toBe(27);
    lod.setFar(true); expect(draws(visual.group)).toBe(10);
    expect(visual.model.children).toEqual(children);
    expect(visual.driverAnchor.parent).toBe(visual.model); expect(visual.seatAnchor.parent).toBe(visual.model);
    expect(visual.resources.geometries).toEqual(geometries); expect(visual.resources.materials).toEqual(materials);
    for (const part of lod.parts) {
      expect(geometries).toContain(part.geometry);
      expect(materials).toContain(part.material);
    }
    lod.setFar(false); expect(draws(visual.group)).toBe(27);
    lod.dispose(); disposeBrHoverSkimmer(visual);
  });
  it("matches every retained vertex transform through bob, steering, occupied lights and world rotation", () => {
    const visual = createBrHoverSkimmer(), lod = createBrSkimmerDistanceLod(visual);
    const sources = visual.model.children.filter(o => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && lod.parts.some(p => p.name === o.name)) as THREE.Mesh[];
    lod.setFar(true);
    for (const occupied of [true, false]) for (const time of [0, .75, 2.4]) {
      updateBrHoverSkimmer(visual, {time, speed: 12, steering: -.8, occupied}); lod.sync();
      visual.group.position.set(21, 7, -13); visual.group.rotation.y = 1.2; visual.group.updateMatrixWorld(true);
      lod.parts.forEach((part, i) => {
        const source = sources[i];
        expect(part.geometry).toBe(source.geometry); expect(part.material).toBe(source.material);
        expect(part.matrixWorld.elements).toEqual(source.matrixWorld.elements);
        expect(part.castShadow).toBe(source.castShadow); expect(part.renderOrder).toBe(source.renderOrder);
        expect(part.frustumCulled).toBe(source.frustumCulled);
        const positions = part.geometry.getAttribute("position"), normals = part.geometry.getAttribute("normal");
        const actualNormal = new THREE.Matrix3().getNormalMatrix(part.matrixWorld);
        const sourceNormal = new THREE.Matrix3().getNormalMatrix(source.matrixWorld);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const actual = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(part.matrixWorld);
          const expected = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(source.matrixWorld);
          expect(actual.distanceTo(expected)).toBeLessThan(1e-10);
          const a = new THREE.Vector3().fromBufferAttribute(normals, vertex).applyNormalMatrix(actualNormal);
          const b = new THREE.Vector3().fromBufferAttribute(normals, vertex).applyNormalMatrix(sourceNormal);
          expect(a.distanceTo(b)).toBeLessThan(1e-10);
        }
      });
    }
    const headlights = lod.parts.filter(p => p.name === "skimmer-headlight");
    const taillights = lod.parts.filter(p => p.name === "skimmer-tail-light");
    expect(headlights).toHaveLength(2); expect(taillights).toHaveLength(2);
    expect(headlights.every(p => p.matrix.elements[14] > 2)).toBe(true);
    expect(taillights.every(p => p.matrix.elements[14] < -2)).toBe(true);
    expect(lod.parts.find(p => p.name === "skimmer-windscreen")!.material).toHaveProperty("transparent", true);
    lod.dispose(); disposeBrHoverSkimmer(visual);
  });
  it("leaves lifetime disposal to the canonical owner and respects external root hiding", () => {
    const visual = createBrHoverSkimmer(), lod = createBrSkimmerDistanceLod(visual);
    const spies = [...visual.resources.geometries, ...visual.resources.materials].map(r => vi.spyOn(r, "dispose"));
    lod.setFar(true); visual.group.visible = false; lod.sync(); expect(draws(visual.group)).toBe(0);
    lod.dispose(); lod.dispose(); spies.forEach(s => expect(s).not.toHaveBeenCalled());
    expect(visual.model.visible).toBe(true); expect(lod.group.parent).toBeNull();
    disposeBrHoverSkimmer(visual); spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    lod.sync(); lod.setFar(true); expect(lod.group.visible).toBe(false);
  });
});
