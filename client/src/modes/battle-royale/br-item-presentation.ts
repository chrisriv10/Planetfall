import { isBrHeal, isBrWeapon, type BrLootState, type BrWeaponId } from "@planetfall/shared";

export type BrLootCategory = "weapon" | "ammo" | "health" | "shield" | "unknown";

/** Shape carries category; the surrounding field/marker color carries rarity. */
export function brLootCategory(state: Pick<BrLootState, "itemId" | "ammoType">): BrLootCategory {
  if (state.itemId && isBrWeapon(state.itemId)) return "weapon";
  if (state.ammoType) return "ammo";
  if (state.itemId && isBrHeal(state.itemId)) return state.itemId.startsWith("shield") ? "shield" : "health";
  return "unknown";
}

export type BrPresentationTransform = Readonly<{
  position: readonly [number,number,number];
  rotation: readonly [number,number,number];
  scale: number;
}>;

const HELD:Record<BrWeaponId,BrPresentationTransform>={
  "pulse-rifle":{position:[.38,.76,.14],rotation:[0,Math.PI,0],scale:.4},
  "nova-smg":{position:[.36,.74,.18],rotation:[0,Math.PI,0],scale:.58},
  "photon-shotgun":{position:[.38,.75,.18],rotation:[0,Math.PI,0],scale:.45},
  "rail-laser":{position:[.38,.78,.13],rotation:[0,Math.PI,0],scale:.37},
  "plasma-launcher":{position:[.39,.73,.14],rotation:[0,Math.PI,0],scale:.46},
  "arc-blaster":{position:[.37,.76,.12],rotation:[0,Math.PI,0],scale:.5},
  "energy-saber":{position:[.42,.72,.26],rotation:[-.9,Math.PI,.12],scale:.58}
};

const LOOT:Record<BrWeaponId,BrPresentationTransform>=Object.fromEntries((Object.keys(HELD) as BrWeaponId[]).map((id)=>[
  id,{position:[0,0,0],rotation:[0,id==="energy-saber"?0:Math.PI/2,id==="energy-saber"?.38:0],scale:id==="rail-laser"?.48:id==="energy-saber"?.6:.56}
])) as unknown as Record<BrWeaponId,BrPresentationTransform>;

export const brHeldWeaponTransform=(id:BrWeaponId):BrPresentationTransform=>HELD[id];
export const brLootWeaponTransform=(id:BrWeaponId):BrPresentationTransform=>LOOT[id];

/** Relative Y from the authoritative pickup origin to its supporting surface. */
export function brLootSurfaceOffset(state:Pick<BrLootState,"position"|"surfaceY">):number {
  const support=Number.isFinite(state.surfaceY)?state.surfaceY!:state.position.y-.58;
  return support-state.position.y+.025;
}
