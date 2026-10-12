import * as THREE from "three";
import type { BrHoverSkimmerVisual } from "./br-hover-skimmer";

const RETAINED = new Set([
  "skimmer-tapered-hull", "skimmer-underbody", "skimmer-upper-deck",
  "skimmer-seat-back", "skimmer-headrest", "skimmer-windscreen",
  "skimmer-headlight", "skimmer-tail-light",
]);

/** Borrow the canonical silhouette and direction lights. Distance policy belongs
 * to the caller. Neither representation owns or removes vehicle state/anchors.
 * Dispose this wrapper before disposing its canonical resource owner. */
export function createBrSkimmerDistanceLod(visual: BrHoverSkimmerVisual) {
  const group = new THREE.Group(); group.name = "skimmer-distance-lod"; group.visible = false;
  const parts: THREE.Mesh[] = [], sources: THREE.Mesh[] = [];
  for (const source of visual.model.children) {
    // Named originals remain available even when exact static batches hide them.
    if (!(source instanceof THREE.Mesh) || source instanceof THREE.InstancedMesh || !RETAINED.has(source.name)) continue;
    const part = new THREE.Mesh(source.geometry, source.material);
    part.name = source.name;
    part.castShadow = source.castShadow; part.receiveShadow = source.receiveShadow;
    part.renderOrder = source.renderOrder; part.layers.mask = source.layers.mask;
    part.frustumCulled = source.frustumCulled;
    part.matrixAutoUpdate = false;
    sources.push(source); parts.push(part); group.add(part);
  }
  if (parts.length !== 10) throw new Error("Canonical skimmer distance LOD requires its ten named silhouette/light parts");
  let far = false, disposed = false;
  const initialVisibility = visual.model.visible;
  const sync = () => {
    if (disposed || visual.disposed) { group.visible = false; return; }
    group.position.copy(visual.model.position); group.quaternion.copy(visual.model.quaternion); group.scale.copy(visual.model.scale);
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (source.matrixAutoUpdate) source.updateMatrix();
      parts[i].matrix.copy(source.matrix); parts[i].matrixWorldNeedsUpdate = true;
    }
  };
  const setFar = (value: boolean) => {
    if (disposed || visual.disposed) return;
    far = value;
    visual.model.visible = initialVisibility && !far;
    group.visible = initialVisibility && far;
    if (far) sync();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; group.removeFromParent(); group.clear();
    if (!visual.disposed) visual.model.visible = initialVisibility;
  };
  visual.group.add(group); sync();
  return { group, parts: parts as readonly THREE.Mesh[], setFar, sync, dispose };
}
