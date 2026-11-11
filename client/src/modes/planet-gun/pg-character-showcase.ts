import {applyAstronautSuitFinish} from "../../astronaut-suit-finish";
import * as THREE from 'three';
import { SHOP_CATALOG, type PgWeaponId } from '@planetfall/shared';
import { createAstronautVisual } from '../../astronaut';
import { createHomePreviewFramer, type HomePreviewRegion } from '../../home-preview-framing';
import type { GraphicsQuality } from '../../settings';
import { createPgCharacterArt } from './pg-character-art';
import { createPgPilotPresentation } from './pg-pilot-presentation';

export type PgCharacterShowcaseSelection = { characterId: string; primary: PgWeaponId; color: string; suit: string;finishId?:string };

/** One display-only canonical pilot; attach to the active owner's identity scene. */
export function createPgCharacterShowcase() {
  const root = new THREE.Group(); root.name = 'pg-character-showcase';
  const rig = createAstronautVisual({ identityColor: '#70f5ff', suitAccent: '#70f5ff', isBot: false });
  rig.group.name = 'pg-showcase-astronaut'; rig.group.position.y = .36;
  const baseGeometries = new Set<THREE.BufferGeometry>(), baseMaterials = new Set<THREE.Material>(), instances: THREE.InstancedMesh[] = [];
  const identityMaterials: (THREE.MeshStandardMaterial | THREE.MeshBasicMaterial)[] = [];
  rig.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    baseGeometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      baseMaterials.add(material);
      if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity === .75 || material instanceof THREE.MeshBasicMaterial && material.color.getHex() === 0x70f5ff) {
        if (!identityMaterials.includes(material)) identityMaterials.push(material);
      }
    }
    if (object instanceof THREE.InstancedMesh) instances.push(object);
  });
  const deckGeometry = new THREE.CylinderGeometry(1.05, 1.12, .14, 32);
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x25374d, roughness: .65, metalness: .35 });
  const deck = new THREE.Mesh(deckGeometry, deckMaterial); deck.name = 'pg-showcase-deck';
  root.add(deck, rig.group);
  const pilot = createPgPilotPresentation(rig), framer = createHomePreviewFramer();
  const bounds = new THREE.Box3(), objectBounds = new THREE.Box3();
  const cameraRotation = new THREE.Quaternion(), stanceRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.04, -.22, 0));
  let art: ReturnType<typeof createPgCharacterArt> | null = null, selection: PgCharacterShowcaseSelection | null = null, disposed = false;

  function pose(time: number, reduced: boolean) {
    const idle = reduced ? 0 : Math.sin(time * .85) * .008;
    rig.helmet.rotation.set(0, .06, idle);
    rig.leftArm.rotation.set(-.38, 0, .22 + idle);
    rig.rightArm.rotation.set(-.9, 0, -.12);
    rig.torso.rotation.set(0, 0, 0); rig.torso.position.set(0, .72, 0);
    if (selection) pilot.display({ weaponId: selection.primary, pitch: -.08,finishId:selection.finishId });
  }

  function measure() {
    // Measure only at identity/weapon changes, with a neutral root transform.
    const position = root.position.clone(), rotation = root.quaternion.clone(), scale = root.scale.clone(), visible = root.visible;
    root.visible = true;
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); root.updateMatrixWorld(true);
    bounds.makeEmpty();
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) { object.computeBoundingBox(); if (object.boundingBox) objectBounds.copy(object.boundingBox); }
      else { if (!object.geometry.boundingBox) object.geometry.computeBoundingBox(); objectBounds.copy(object.geometry.boundingBox!); }
      objectBounds.applyMatrix4(object.matrixWorld); bounds.union(objectBounds);
    });
    bounds.expandByScalar(.055); // Head/left-arm idle envelope; feet remain planted.
    root.position.copy(position); root.quaternion.copy(rotation); root.scale.copy(scale); root.visible = visible;
  }

  function setSelection(next: PgCharacterShowcaseSelection) {
    if (disposed) return;
    const identityChanged = selection?.characterId !== next.characterId, weaponChanged = selection?.primary !== next.primary;
    if (identityChanged) { art?.dispose(); art = createPgCharacterArt(rig, next.characterId); }
    rig.suitMaterial.color.set(SHOP_CATALOG.find(item => item.id === next.suit && item.category === 'suit')?.color ?? next.color);applyAstronautSuitFinish(rig,SHOP_CATALOG.find(item=>item.id===next.suit)?.suitStyle??null);
    for (const material of identityMaterials) { material.color.set(next.color); if (material instanceof THREE.MeshStandardMaterial) material.emissive.set(next.color); }
    selection = { ...next };
    if (identityChanged || weaponChanged) {
      for (const detail of rig.lodDetails) detail.visible = true;
      pose(0, true); measure();
    }
  }

  function update(camera: THREE.PerspectiveCamera, region: HomePreviewRegion, timeSeconds: number, quality: GraphicsQuality, reducedMotion: boolean) {
    if (disposed || !selection) return;
    for (const detail of rig.lodDetails) detail.visible = quality !== 'low';
    pose(Number.isFinite(timeSeconds) ? timeSeconds : 0, reducedMotion);
    camera.getWorldQuaternion(cameraRotation); root.quaternion.copy(cameraRotation).multiply(stanceRotation);
    framer.fit(root, bounds, camera, region, Math.max(6, camera.near * 4));
  }

  function dispose() {
    if (disposed) return; disposed = true;
    // These restore the base rig and detach borrowed library models first.
    art?.dispose(); pilot.dispose();
    for (const instance of instances) instance.dispose();
    for (const geometry of baseGeometries) geometry.dispose();
    for (const material of baseMaterials) material.dispose();
    deckGeometry.dispose(); deckMaterial.dispose(); root.clear(); root.removeFromParent();
  }
  return { root, setSelection, update, dispose };
}
