import { isBrHeal, isBrWeapon, BR_UTILITIES, type BrLootState, type BrWeaponId } from "@planetfall/shared";
import * as THREE from "three";
import { BR_LOOT_FLOAT } from "./br-loot-rarity";

export type BrLootCategory = "weapon" | "ammo" | "health" | "shield" | "utility" | "unknown";

/** Shape carries category; the surrounding field/marker color carries rarity. */
export function brLootCategory(state: Pick<BrLootState, "itemId" | "ammoType">): BrLootCategory {
  if (state.itemId && isBrWeapon(state.itemId)) return "weapon";
  if (state.ammoType) return "ammo";
  if (state.itemId && state.itemId in BR_UTILITIES) return "utility";
  if (state.itemId && isBrHeal(state.itemId)) return state.itemId.startsWith("shield") ? "shield" : "health";
  return "unknown";
}

export type BrPresentationTransform = Readonly<{
  position: readonly [number,number,number];
  rotation: readonly [number,number,number];
  scale: number;
}>;

const HELD:Record<BrWeaponId,BrPresentationTransform>={
  "helix-burst-rifle":{position:[.05,.12,-.13],rotation:[0,Math.PI,0],scale:.46},
  "comet-hand-cannon":{position:[.03,.17,-.07],rotation:[0,Math.PI,0],scale:.58},
  "quasar-carbine":{position:[.05,.11,-.11],rotation:[0,Math.PI,0],scale:.43},
  "prism-beam":{position:[.05,.14,-.08],rotation:[0,Math.PI,0],scale:.48},
  "vortex-cannon":{position:[.05,.14,-.05],rotation:[0,Math.PI,0],scale:.48},
  // Positions are offsets from the canonical astronaut's right glove anchor,
  // never torso-local magic coordinates. The offset compensates each model's
  // grip position after its scale/rotation is applied.
  "pulse-rifle":{position:[.05,.11,-.13],rotation:[0,Math.PI,0],scale:.4},
  "nova-smg":{position:[.05,.16,-.14],rotation:[0,Math.PI,0],scale:.58},
  "photon-shotgun":{position:[.05,.14,-.12],rotation:[0,Math.PI,0],scale:.45},
  "rail-laser":{position:[.05,.1,-.13],rotation:[0,Math.PI,0],scale:.37},
  "plasma-launcher":{position:[.05,.14,-.1],rotation:[0,Math.PI,0],scale:.46},
  "arc-blaster":{position:[.06,.14,-.12],rotation:[0,Math.PI,0],scale:.5},
  "energy-saber":{position:[.02,.02,-.03],rotation:[-.9,Math.PI,.12],scale:.58}
};

const LOOT:Record<BrWeaponId,BrPresentationTransform>=Object.fromEntries((Object.keys(HELD) as BrWeaponId[]).map((id)=>[
  id,{position:[0,0,0],rotation:[0,id==="energy-saber"?0:Math.PI/2,id==="energy-saber"?.38:0],scale:id==="rail-laser"?.48:id==="energy-saber"?.6:.56}
])) as unknown as Record<BrWeaponId,BrPresentationTransform>;

export const brHeldWeaponTransform=(id:BrWeaponId):BrPresentationTransform=>HELD[id];
export const brLootWeaponTransform=(id:BrWeaponId):BrPresentationTransform=>LOOT[id];

const UTILITY_HELD:Record<keyof typeof BR_UTILITIES,BrPresentationTransform>={
  "grav-coil":{position:[0,.08,0],rotation:[0,Math.PI,0],scale:.7},
  "void-filter":{position:[0,.06,0],rotation:[0,Math.PI,0],scale:.7},
  "pulse-scanner":{position:[0,.1,0],rotation:[-.2,Math.PI,0],scale:.7},
  "nano-mist":{position:[0,.08,0],rotation:[0,Math.PI,0],scale:.7}
};
const UTILITY_LOOT:BrPresentationTransform={position:[0,0,0],rotation:[0,0,0],scale:1};
export const brHeldUtilityTransform=(id:keyof typeof BR_UTILITIES):BrPresentationTransform=>UTILITY_HELD[id];
export const brLootUtilityTransform=(_id:keyof typeof BR_UTILITIES):BrPresentationTransform=>UTILITY_LOOT;

/** Minimum model-pivot height needed to keep transformed geometry above its
 * resolved support. This is presentation-only: authoritative pickup positions
 * stay untouched while tall/rotated models get their own correct clearance. */
export function brLootModelSupportLift(model:THREE.Object3D,clearance=.07):number {
  model.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(model);
  if(bounds.isEmpty()||!Number.isFinite(bounds.min.y))return .42;
  return Math.max(BR_LOOT_FLOAT.lift,-bounds.min.y+Math.max(0,clearance)+BR_LOOT_FLOAT.amplitude);
}

/** Relative Y from the authoritative pickup origin to its supporting surface. */
export function brLootSurfaceOffset(state:Pick<BrLootState,"position"|"surfaceY">):number {
  const support=Number.isFinite(state.surfaceY)?state.surfaceY!:state.position.y-.58;
  return support-state.position.y+.025;
}
