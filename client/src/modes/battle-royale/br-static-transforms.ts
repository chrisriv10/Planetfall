import * as THREE from "three";

/** Authoring is complete before this runs. Dynamic machinery/labels keep their
 * transforms; fixed gameplay worlds also retain their already-computed world
 * matrices when Three updates the enclosing scene each frame. */
export function freezeBrStaticTransforms(root: THREE.Object3D, moving: readonly THREE.Object3D[], fixedWorld: boolean): void {
  const dynamic = new Set<THREE.Object3D>();
  for (const object of moving) object.traverse(child => dynamic.add(child));
  root.traverse(object => { if (object instanceof THREE.Sprite) dynamic.add(object); });
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (object === root || dynamic.has(object)) return;
    object.matrixAutoUpdate = false;
    if (fixedWorld) object.matrixWorldAutoUpdate = false;
  });
  if (!fixedWorld || dynamic.has(root)) return;
  // Three still descends through cached objects (including hidden interiors)
  // on every scene update. A completed, fixed gameplay island has no moving
  // ancestors: update only the outermost machinery/label roots. Their cached
  // parent world matrices are the same ones used by rendering and raycasts.
  // Movable home previews retain Three's normal recursive update above.
  const movingRoots = [...dynamic].filter(object => object.parent && !dynamic.has(object.parent));
  root.matrixAutoUpdate = false;
  root.matrixWorldAutoUpdate = false;
  root.updateMatrixWorld = (force?: boolean): void => {
    for (const object of movingRoots) object.updateMatrixWorld(force);
  };
}
