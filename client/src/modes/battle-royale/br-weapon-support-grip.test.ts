import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createAstronautVisual } from "../../astronaut";
import { createAstronautArmArticulation } from "../../astronaut-arm-articulation";
import { buildBrWeaponModel } from "./br-weapons";
import { addBrWeaponSupportGrip, anchorBrSupportedWeapon, type BrSupportWeaponId } from "./br-weapon-support-grip";

const contracts = [
  ["helix-burst-rifle", .46, -.26, -.28],
] as const;

// Feasibility regression: use actual posed glove vertices, not an enclosing
// sphere, to reject a receiver-centered attachment that buries the hands.
it("rejects the centered Helix candidate because actual gloves intersect its original meshes", () => {
  const rig = createAstronautVisual({ identityColor: "#70f5ff", suitAccent: "#ffd84d", isBot: false });
  const controller = createAstronautArmArticulation(rig);
  controller.apply(true);
  rig.group.updateMatrixWorld(true);
  const gloveVertices: THREE.Vector3[] = [];
  for (const arm of [rig.leftArm, rig.rightArm]) {
    arm.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.SphereGeometry)) return;
      if (object.geometry.parameters.radius !== .18) return;
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        gloveVertices.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
      }
    });
  }
  expect(gloveVertices.length).toBeGreaterThan(0);
  for (const [id, scale, gripY, gripZ] of contracts) {
    const weapon = new THREE.Group();
    buildBrWeaponModel(weapon, id as BrSupportWeaponId, 0xffffff);
    for (const forward of [.24, .26, .28]) for (const down of [.06, .07, .08]) {
      weapon.rotation.y = Math.PI;
      weapon.scale.setScalar(scale);
      weapon.position.set(0, 1.18 - gripY * scale - down, .68 + gripZ * scale + forward);
      weapon.updateMatrixWorld(true);
      let intersections = 0;
      weapon.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BoxGeometry)) return;
        object.geometry.computeBoundingBox();
        const inverse = object.matrixWorld.clone().invert();
        for (const vertex of gloveVertices) {
          if (object.geometry.boundingBox!.containsPoint(vertex.clone().applyMatrix4(inverse))) intersections++;
        }
      });
      expect(intersections, `${id}, forward ${forward}, down ${down}`).toBeGreaterThan(0);
    }
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    weapon.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    });
    for (const resource of resources) resource.dispose();
  }
  controller.dispose();
});

it.each([
  ["helix-burst-rifle", 1],
  ["quasar-carbine", 2],
  ["prism-beam", 1],
  ["vortex-cannon", 1],
] as const)("retracts %s stock reversibly and clears both gloves with the exposed receiver", (id, stockCount) => {
  const weapon = new THREE.Group();
  buildBrWeaponModel(weapon, id, 0xffffff);
  weapon.updateMatrixWorld(true);
  const original = weapon.children.slice();
  const poses = original.map(part => part.matrix.clone());
  const box = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const prototype = addBrWeaponSupportGrip(weapon, id, box, material);
  expect(prototype.retractedParts.length).toBe(stockCount);
  expect(prototype.addedParts.length).toBe(4);
  const disposeCylinder = vi.spyOn(prototype.addedParts[0].geometry, "dispose");
  const right = new THREE.Vector3(.19, 1.18, .68);
  const left = new THREE.Vector3(-.19, 1.18, .68);
  anchorBrSupportedWeapon(weapon, id, right);
  weapon.updateMatrixWorld(true);
  for (const part of prototype.addedParts.filter(part => part.name === "weapon-grasped-handle")) {
    expect(new THREE.Box3().setFromObject(part).max.y).toBeLessThan(1.21);
  }
  expect(weapon.getObjectByName("weapon-primary-grip")!.getWorldPosition(new THREE.Vector3()).distanceTo(right)).toBeLessThan(1e-8);
  expect(weapon.getObjectByName("weapon-support-grip")!.getWorldPosition(new THREE.Vector3()).distanceTo(left)).toBeLessThan(1e-8);
  const triangle = new THREE.Triangle();
  const nearest = new THREE.Vector3();
  weapon.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    // The two grasped handles intentionally occupy the hands; every other
    // visible mesh must clear even the full .18m glove-enclosing sphere.
    if (object.name === "weapon-grasped-handle") return;
    const positions = object.geometry.getAttribute("position");
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      [triangle.a, triangle.b, triangle.c].forEach((point, offset) => {
        point.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(object.matrixWorld);
      });
      for (const wrist of [left, right]) {
        triangle.closestPointToPoint(wrist, nearest);
        expect(nearest.distanceTo(wrist), object.name || `canonical part ${original.indexOf(object)}`).toBeGreaterThan(.18);
      }
    }
  });
  expect(new THREE.Vector3(0, 0, -1).applyQuaternion(weapon.quaternion).z).toBeCloseTo(1);
  original.forEach((part, i) => { expect(part.matrix.elements).toEqual(poses[i].elements); });
  prototype.restore();
  prototype.restore();
  expect(disposeCylinder).toHaveBeenCalledTimes(1);
  expect(weapon.children).toEqual(original);
  expect(original.every(part => part.visible)).toBe(true);
  box.dispose();
  material.dispose();
});

it("borrows an optional cached cylinder without disposing caller resources", () => {
  const weapon = new THREE.Group();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const cylinderDispose = vi.spyOn(cylinder, "dispose");
  const materialDispose = vi.spyOn(material, "dispose");
  const prototype = addBrWeaponSupportGrip(weapon, "helix-burst-rifle", box, material, { cylinder });
  expect(prototype.addedParts.every(part => part.geometry === cylinder && part.material === material)).toBe(true);
  prototype.restore();
  expect(cylinderDispose).not.toHaveBeenCalled();
  expect(materialDispose).not.toHaveBeenCalled();
  cylinder.dispose();
  box.dispose();
  material.dispose();
});
