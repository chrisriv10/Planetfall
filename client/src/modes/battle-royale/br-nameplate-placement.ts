import * as THREE from "three";

/** Small visual clearance in world units, in addition to the full sprite
 * lower half. Transparent canvas padding is deliberately not relied upon. */
export const BR_NAMEPLATE_HELMET_GAP = .14;

/** Capture actual helmet (including antenna/visor) geometry once at creation.
 * The returned update transforms just eight cached local corners per frame.
 * It writes only label.position, leaving visibility, scale and ownership alone.
 * Apply after posing, label scale selection and the current camera transform.
 * Labels use canonical unrotated camera-facing sprites with sizeAttenuation. */
export function createBrNameplatePlacement(helmet: THREE.Object3D) {
  helmet.updateWorldMatrix(true, true);
  const inverseHelmet = new THREE.Matrix4().copy(helmet.matrixWorld).invert();
  const localBounds = new THREE.Box3(), meshBounds = new THREE.Box3(), transform = new THREE.Matrix4();
  helmet.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    transform.multiplyMatrices(inverseHelmet, mesh.matrixWorld);
    meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(transform);
    localBounds.union(meshBounds);
  });
  if (localBounds.isEmpty()) throw new Error("Nameplate placement requires helmet geometry");
  const corners: THREE.Vector3[] = [];
  for (const x of [localBounds.min.x, localBounds.max.x]) for (const y of [localBounds.min.y, localBounds.max.y]) for (const z of [localBounds.min.z, localBounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const point = new THREE.Vector3(), target = new THREE.Vector3(), scale = new THREE.Vector3();
  const viewHelmet = new THREE.Matrix4(), parentInverse = new THREE.Matrix4();

  return {
    update(label: THREE.Sprite, camera: THREE.Camera, gap = BR_NAMEPLATE_HELMET_GAP): void {
      helmet.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      viewHelmet.multiplyMatrices(camera.matrixWorldInverse, helmet.matrixWorld);
      const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
      let minX = Infinity, maxX = -Infinity, top = -Infinity, minDepth = Infinity, maxDepth = -Infinity;
      for (const corner of corners) {
        point.copy(corner).applyMatrix4(viewHelmet);
        const depth = -point.z;
        // A helmet crossing the camera plane cannot have a finite projected
        // bound. Keep the last finite anchor; caller retains visibility policy.
        if (perspective && depth <= .01) return;
        const divisor = perspective ? depth : 1;
        minX = Math.min(minX, point.x / divisor); maxX = Math.max(maxX, point.x / divisor);
        top = Math.max(top, point.y / divisor);
        minDepth = Math.min(minDepth, depth); maxDepth = Math.max(maxDepth, depth);
      }
      const depth = (minDepth + maxDepth) / 2;
      label.updateWorldMatrix(true, false);
      scale.setFromMatrixScale(label.matrixWorld);
      const lowerHalf = Math.abs(scale.y) * label.center.y;
      const divisor = perspective ? depth : 1;
      target.set((minX + maxX) * .5 * divisor, top * divisor + lowerHalf + Math.max(0, gap), -depth).applyMatrix4(camera.matrixWorld);
      if (label.parent) {
        parentInverse.copy(label.parent.matrixWorld).invert(); target.applyMatrix4(parentInverse);
      }
      label.position.copy(target);
    }
  };
}
