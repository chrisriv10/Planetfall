import * as THREE from "three";

/** Exact instancing within one animation root. BoxGeometry dimensions are
 * absorbed into each instance transform; positions, axial normals and UVs are
 * identical. Other shapes only batch when they already share a geometry.
 * Named source meshes remain hidden for existing inspection/anchor APIs.
 * They continue to borrow their original owned geometry/material resources. */
export function batchBrSkimmerStaticParts(root: THREE.Group, animated: ReadonlySet<THREE.Object3D>): THREE.InstancedMesh[] {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const object of root.children) {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || animated.has(object) || !object.visible || Array.isArray(object.material)) continue;
    const material = object.material;
    if (material.transparent || material.opacity !== 1 || object.morphTargetInfluences || object.geometry.morphAttributes.position?.length) continue;
    const geometry: THREE.BufferGeometry = object.geometry;
    const box = geometry instanceof THREE.BoxGeometry && geometry.parameters.widthSegments === 1 && geometry.parameters.heightSegments === 1 && geometry.parameters.depthSegments === 1;
    const shape = box ? "unit-box" : geometry.uuid;
    const attributes = Object.entries(geometry.attributes).map(([key, value]) => `${key}:${value.itemSize}:${value.normalized}:${value.array.constructor.name}`).join("|");
    const key = `${shape}:${attributes}:${material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${object.layers.mask}:${object.frustumCulled}`;
    const bucket = buckets.get(key) ?? []; bucket.push(object); buckets.set(key, bucket);
  }
  const batches: THREE.InstancedMesh[] = [];
  const matrix = new THREE.Matrix4(), dimensions = new THREE.Matrix4();
  for (const parts of buckets.values()) {
    if (parts.length < 2) continue;
    const first = parts[0], geometry = first.geometry;
    const batch = new THREE.InstancedMesh(geometry, first.material, parts.length);
    batch.name = `skimmer-static-batch-${batches.length}`;
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow; batch.renderOrder = first.renderOrder;
    batch.layers.mask = first.layers.mask; batch.frustumCulled = first.frustumCulled;
    batch.userData.sourceNames = parts.map(part => part.name);
    batch.userData.sourceUuids = parts.map(part => part.uuid);
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]; part.updateMatrix(); matrix.copy(part.matrix);
      if (geometry instanceof THREE.BoxGeometry && part.geometry instanceof THREE.BoxGeometry) {
        const a = geometry.parameters, b = part.geometry.parameters;
        dimensions.makeScale(b.width / a.width, b.height / a.height, b.depth / a.depth); matrix.multiply(dimensions);
      }
      batch.setMatrixAt(index, matrix); part.visible = false;
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox(); batch.computeBoundingSphere();
    root.add(batch); batches.push(batch);
  }
  return batches;
}

