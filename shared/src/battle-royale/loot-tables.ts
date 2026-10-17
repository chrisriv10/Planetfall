import type { BrHealId, BrWeaponId, BrUtilityId, BrLootState } from "./types.js";
import {BR_UTILITIES} from "./utilities.js";
import {BR_WEAPONS} from "./balance.js";
import {BR_CONSUMABLE_RARITIES} from "./rarity.js";
import type { BrRarity } from "./rarity.js";

export type BrWeighted<T> = readonly (readonly [T, number])[];
export function brWeightedChoice<T>(table:BrWeighted<T>,random:()=>number):T {
  const total=table.reduce((sum,[,weight])=>sum+weight,0);
  if(!(total>0)||table.some(([,weight])=>!Number.isFinite(weight)||weight<=0))throw new Error("Invalid loot weights");
  let roll=Math.max(0,Math.min(.999999999,random()))*total;
  for(const [value,weight]of table){roll-=weight;if(roll<0)return value;}
  return table[table.length-1][0];
}
export const BR_GROUND_WEAPONS:BrWeighted<BrWeaponId> = [["pulse-rifle",22],["nova-smg",19],["photon-shotgun",14],["arc-blaster",9],["rail-laser",6],["plasma-launcher",5],["energy-saber",3],["helix-burst-rifle",10],["comet-hand-cannon",6],["quasar-carbine",6]];
export const BR_NORMAL_HEALS:BrWeighted<BrHealId> = [["med-patch",38],["shield-cell",38],["med-kit",12],["shield-battery",12]];
export const BR_GROUND_RARITIES:BrWeighted<BrRarity> = [["common",46],["uncommon",32],["rare",17],["epic",4.5],["legendary",.5]];
export const BR_CRATE_RARITIES:BrWeighted<BrRarity> = [["uncommon",30],["rare",45],["epic",20],["legendary",5]];
export const BR_UTILITY_WEIGHTS:BrWeighted<BrUtilityId>=[["grav-coil",35],["void-filter",20],["pulse-scanner",15],["nano-mist",30]];

export type BrCrateContent=Pick<BrLootState,"itemId"|"ammoType"|"rarity"|"count"|"magazine">;
/** Three useful roles, with the special roll confined to the weapon slot.
 * High-value identifies an existing authored landmark crate, never new geometry. */
export function brCrateContents(random:()=>number,highValue=false):BrCrateContent[]{
  const special=random();
  const weaponId:BrWeaponId=highValue&&special<.005?"vortex-cannon":special<(highValue?.04:.012)?"prism-beam":brWeightedChoice(BR_GROUND_WEAPONS,random);
  const weapon=BR_WEAPONS[weaponId];
  const rarity:BrRarity="fixedRarity" in weapon?weapon.fixedRarity:brWeightedChoice(BR_CRATE_RARITIES,random);
  const drops:BrCrateContent[]=[{itemId:weaponId,rarity,count:1,magazine:weapon.magazine}];
  if(weapon.ammo&&random()<.7)drops.push({ammoType:weapon.ammo,rarity:"common",count:weapon.ammo==="light"?54:weapon.ammo==="heavy"?18:12});
  else {const itemId=brWeightedChoice(BR_UTILITY_WEIGHTS,random);drops.push({itemId,rarity:BR_UTILITIES[itemId].rarity,count:1,magazine:0});}
  if(random()<.35){const itemId=brWeightedChoice(BR_UTILITY_WEIGHTS,random);drops.push({itemId,rarity:BR_UTILITIES[itemId].rarity,count:1,magazine:0});}
  else {const itemId=brWeightedChoice(BR_NORMAL_HEALS,random);drops.push({itemId,rarity:BR_CONSUMABLE_RARITIES[itemId],count:itemId==="med-patch"||itemId==="shield-cell"?2:1,magazine:0});}
  return drops;
}
