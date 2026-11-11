import * as THREE from "three";
import {weaponFinishForId,type PgWeaponId} from "@planetfall/shared";
import { createHomePreviewFramer, type HomePreviewRegion } from "../../home-preview-framing";
import type { GraphicsQuality } from "../../settings";
import { createPgPreviewModels } from "./pg-kit-preview";

/** Display-only model for an identity-transformed scene on the existing renderer. */
export function createPgWeaponShowcase() {
  const root = new THREE.Group();
  root.name = "pg-weapon-showcase";
  root.visible = false;
  const framer = createHomePreviewFramer();
  const bounds = new THREE.Box3(), point = new THREE.Vector3(), stance = new THREE.Euler();
  const rotation = new THREE.Quaternion();
  let owner: ReturnType<typeof createPgPreviewModels> | null = null;
  let selected: PgWeaponId | null = null, disposed = false;

  function setSelection(id: PgWeaponId | null,finishId?:string) {
    if(disposed)return;
    if(selected===id){if(id&&owner)owner.get(id).finish.setFinish(weaponFinishForId(finishId));return;}
    // Each owner borrows its model meshes from its own canonical library.
    // Its dispose detaches instances first, then releases library and PG hardware.
    owner?.dispose(); owner = null;
    selected = id;
    root.visible = id !== null;
    if (!id) return;
    owner = createPgPreviewModels();
    const model = owner.get(id);
    model.modules.setModules([]);model.finish.setFinish(weaponFinishForId(finishId));
    // Measure only visible standard hardware before attaching to the framed root.
    // Read vertices directly so shared geometry and its bounding caches stay intact.
    bounds.makeEmpty();
    model.root.updateMatrixWorld(true);
    model.root.traverseVisible(part => {
      if (!(part instanceof THREE.Mesh)) return;
      const positions = part.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld));
      }
    });
    root.add(model.root);
  }
  function update(camera: THREE.PerspectiveCamera, region: HomePreviewRegion, timeSeconds: number, _quality: GraphicsQuality, reducedMotion: boolean) {
    if (disposed || !selected) return;
    const sway = reducedMotion || !Number.isFinite(timeSeconds) ? 0 : Math.sin(timeSeconds * .47) * .085;
    stance.set(.12, -1.27 + sway, -.035);
    camera.getWorldQuaternion(root.quaternion);
    root.quaternion.multiply(rotation.setFromEuler(stance));
    framer.fit(root, bounds, camera, region, Math.max(6, camera.near * 4));
  }
  function dispose() {
    if (disposed) return;
    setSelection(null);
    root.removeFromParent();
    disposed = true;
  }
  return {root, background:new THREE.Color(0x0c131b), lighting:"weapon" as const, setSelection, update, dispose};
}
