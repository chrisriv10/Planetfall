import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createAstronautVisual } from "../../astronaut";
import { createBrNameplatePlacement } from "./br-nameplate-placement";

function dispose(root: THREE.Object3D) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  root.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => resources.add(material)); });
  resources.forEach(resource => resource.dispose());
}

describe("BR canonical helmet nameplate placement", () => {
  it("clears real helmet geometry and antenna at close/side/diagonal/downward angles in all poses and sprite sizes", () => {
    const astronaut = createAstronautVisual({ identityColor: "#70f5ff", suitAccent: "#ffd84d", isBot: true });
    const parent = new THREE.Group(); parent.position.set(13, 4, -8); parent.rotation.y = .7; parent.add(astronaut.group);
    astronaut.group.rotation.y = Math.PI;
    const label = new THREE.Sprite(new THREE.SpriteMaterial()); parent.add(label);
    const placement = createBrNameplatePlacement(astronaut.helmet);
    const camera = new THREE.PerspectiveCamera(22, 16 / 9, .08, 1000);
    const focus = new THREE.Vector3(13, 5, -8);
    for (const [pitch, height] of [[0, .26], [.3, .04], [.38, .55], [.72, .55], [-1.12, .12]]) {
      astronaut.group.rotation.x = pitch; astronaut.group.position.y = height;
      for (const offset of [[0, 1, 3.5], [4, 1, 0], [4, 3, 4], [.3, 7, 2]]) for (const spriteHeight of [1.5, 3.8]) {
        camera.position.copy(focus).add(new THREE.Vector3(...offset)); camera.lookAt(focus); camera.updateMatrixWorld(true);
        label.scale.set(spriteHeight * 2.6, spriteHeight, 1);
        placement.update(label, camera); parent.updateMatrixWorld(true);
        let helmetTop = -Infinity;
        astronaut.helmet.traverse(object => {
          const mesh = object as THREE.Mesh; if (!mesh.geometry) return;
          const vertices = mesh.geometry.getAttribute("position");
          for (let i = 0; i < vertices.count; i++) helmetTop = Math.max(helmetTop, new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(camera).y);
        });
        const labelCenter = label.getWorldPosition(new THREE.Vector3());
        const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
        const labelBottom = labelCenter.addScaledVector(up, -spriteHeight * .5).project(camera).y;
        expect(labelBottom - helmetTop, `pitch ${pitch}, camera ${offset}, scale ${spriteHeight}`).toBeGreaterThan(.001);
        expect(label.position.toArray().every(Number.isFinite)).toBe(true);
      }
    }
    dispose(parent);
  });
  it("uses cached bounds without per-frame geometry traversal and retains sprite presentation policy", () => {
    const astronaut = createAstronautVisual({ identityColor: "#70f5ff", suitAccent: "#70f5ff", isBot: false });
    const parent = new THREE.Group(); parent.add(astronaut.group);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true })); label.visible = false; label.scale.set(4, 1.5, 1); parent.add(label);
    const placement = createBrNameplatePlacement(astronaut.helmet), traverse = vi.spyOn(astronaut.helmet, "traverse");
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 5); camera.lookAt(0, 1, 0);
    for (let i = 0; i < 4; i++) placement.update(label, camera);
    expect(traverse).not.toHaveBeenCalled(); expect(label.visible).toBe(false); expect(label.scale.toArray()).toEqual([4, 1.5, 1]); expect(label.material.depthTest).toBe(true);
    traverse.mockRestore(); dispose(parent);
  });
});
