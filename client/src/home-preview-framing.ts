import * as THREE from 'three';

export type HomePreviewRegion = {
  viewportWidth: number; viewportHeight: number;
  left: number; top: number; width: number; height: number;
};

/** Fits cached root-local bounds. The caller's scene parent must have identity transform. */
export function createHomePreviewFramer() {
  const center = new THREE.Vector3(), point = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(), cameraRotation = new THREE.Quaternion();
  const relativeRotation = new THREE.Quaternion(), inverseCamera = new THREE.Quaternion();
  const offset = new THREE.Vector3(), centerOffset = new THREE.Vector3();
  return {
    fit(root: THREE.Object3D, localBounds: THREE.Box3, camera: THREE.PerspectiveCamera, region: HomePreviewRegion, distance = 38): void {
      const { viewportWidth: vw, viewportHeight: vh, left, top, width, height } = region;
      if (!Number.isFinite(vw + vh + left + top + width + height + distance + camera.near
        + localBounds.min.x + localBounds.min.y + localBounds.min.z + localBounds.max.x + localBounds.max.y + localBounds.max.z)
        || vw <= 0 || vh <= 0 || width <= 0 || height <= 0 || localBounds.isEmpty()) return;
      const projection = camera.projectionMatrix.elements, px = projection[0], py = projection[5];
      if (!Number.isFinite(px) || !Number.isFinite(py) || px <= 0 || py <= 0) return;
      const depth = Math.max(distance, camera.near * 4, 1);
      const margin = Math.min(16, width * .1, height * .1);
      const l = (left + margin) / vw * 2 - 1 + projection[8];
      const r = (left + width - margin) / vw * 2 - 1 + projection[8];
      const b = 1 - (top + height - margin) / vh * 2 + projection[9];
      const t = 1 - (top + margin) / vh * 2 + projection[9];
      const cx = (l + r) * .5, cy = (b + t) * .5;
      camera.getWorldPosition(cameraPosition); camera.getWorldQuaternion(cameraRotation);
      inverseCamera.copy(cameraRotation).invert(); relativeRotation.copy(inverseCamera).multiply(root.quaternion);
      localBounds.getCenter(center);
      let scale = Infinity;
      for (let i = 0; i < 8; i++) {
        point.set(i & 1 ? localBounds.max.x : localBounds.min.x, i & 2 ? localBounds.max.y : localBounds.min.y, i & 4 ? localBounds.max.z : localBounds.min.z)
          .sub(center).applyQuaternion(relativeRotation);
        // Perspective inequalities are linear in scale, including off-axis depth.
        const right = px * point.x + r * point.z, left = px * point.x + l * point.z;
        const upper = py * point.y + t * point.z, lower = py * point.y + b * point.z;
        if (right > 0) scale = Math.min(scale, (r - cx) * depth / right);
        if (left < 0) scale = Math.min(scale, (l - cx) * depth / left);
        if (upper > 0) scale = Math.min(scale, (t - cy) * depth / upper);
        if (lower < 0) scale = Math.min(scale, (b - cy) * depth / lower);
        if (point.z > 0) scale = Math.min(scale, (depth - Math.max(camera.near * 1.1, .01)) / point.z);
      }
      if (!Number.isFinite(scale) || scale <= 0) return;
      scale *= .995; // Numerical headroom without a visible change in composition.
      offset.set(cx * depth / px, cy * depth / py, -depth).applyQuaternion(cameraRotation);
      centerOffset.copy(center).applyQuaternion(root.quaternion).multiplyScalar(scale);
      root.position.copy(cameraPosition).add(offset).sub(centerOffset);
      root.scale.setScalar(scale);
    },
  };
}
