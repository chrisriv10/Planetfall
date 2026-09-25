import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createVerityPlanetVisual, disposeVerityPlanetVisual, updateVerityPlanetVisual } from "./planet-cosmetics";

describe("Verity planet presentation", () => {
  it("keeps the shell on the gameplay radius and ink close to its surface", () => {
    const radius = 8;
    const visual = createVerityPlanetVisual(radius);
    const point = new THREE.Vector3();
    for (const mesh of [visual.shell, visual.face]) {
      const vertices = mesh.geometry.getAttribute("position");
      for (let index = 0; index < vertices.count; index++) {
        point.fromBufferAttribute(vertices, index);
        expect(point.length()).toBeGreaterThanOrEqual(radius - .00001);
        expect(point.length()).toBeLessThan(radius * 1.001);
      }
    }
    // All face triangles must face out of the sphere so backface culling
    // cannot make either the curved smile or the eyes disappear.
    const vertices = visual.face.geometry.getAttribute("position");
    const indices = visual.face.geometry.index!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let index = 0; index < indices.count; index += 3) {
      a.fromBufferAttribute(vertices, indices.getX(index));
      b.fromBufferAttribute(vertices, indices.getX(index + 1));
      c.fromBufferAttribute(vertices, indices.getX(index + 2));
      expect(b.sub(a).cross(c.sub(a)).dot(a)).toBeGreaterThan(0);
    }
    disposeVerityPlanetVisual(visual);
  });

  it("faces a moving camera while leaving the containing planet transform intact", () => {
    const planet = new THREE.Group();
    planet.position.set(20, -8, 12);
    planet.rotation.set(.2, .6, -.4);
    const rotation = planet.quaternion.clone();
    const visual = createVerityPlanetVisual(8);
    planet.add(visual.group);
    const camera = new THREE.PerspectiveCamera();
    for (const position of [[30, 18, 45], [-20, 3, -30], [20, 40, 12]]) {
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(planet.position);
      camera.rotateZ(.3);
      updateVerityPlanetVisual(visual, camera);
      const outward = visual.group.getWorldDirection(new THREE.Vector3());
      const towardsCamera = camera.position.clone().sub(planet.position).normalize();
      expect(outward.dot(towardsCamera)).toBeCloseTo(1, 6);
      expect(planet.quaternion.equals(rotation)).toBe(true);
    }
    disposeVerityPlanetVisual(visual);
  });

  it("releases its own geometry and materials when unequipped", () => {
    const visual = createVerityPlanetVisual(8);
    const parent = new THREE.Group();
    parent.add(visual.group);
    const disposals = [visual.shell.geometry, visual.shell.material, visual.face.geometry, visual.face.material]
      .map((resource) => vi.spyOn(resource, "dispose"));
    disposeVerityPlanetVisual(visual);
    expect(parent.children).toHaveLength(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
  });
});
