import * as THREE from "three";

const mounts = new WeakMap<THREE.Object3D, THREE.Quaternion>();
const rotation = new THREE.Quaternion();
const axes = { x: new THREE.Vector3(1,0,0), y: new THREE.Vector3(0,1,0), z: new THREE.Vector3(0,0,1) };

/** Spin in the parent's frame without replacing the model's mounted tilt.
 * Scratch storage is reused; weak mount records do not retain disposed worlds. */
export function spinBrMachinery(object: THREE.Object3D, angle: number, axis: "x" | "y" | "z" = "y"): void {
  let mount = mounts.get(object);
  if (!mount) { mount=object.quaternion.clone();mounts.set(object,mount); }
  object.quaternion.copy(mount).premultiply(rotation.setFromAxisAngle(axes[axis],angle));
}
