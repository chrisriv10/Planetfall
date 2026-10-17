import {brPickupDisposition,brWeaponStats,isBrWeapon,type BrAmmoState,type BrInventoryItem,type BrLootState} from "@planetfall/shared";

/** Range and ammunition determine suitability before rarity refinement. */
export function brBotWeaponScore(item:BrInventoryItem|null,ammo:BrAmmoState,distance:number):number {
  if(!item||!isBrWeapon(item.itemId))return -Infinity;
  const weapon=brWeaponStats(item.itemId,item.rarity);
  if(weapon.ammo&&item.magazine+ammo[weapon.ammo]<=0)return -Infinity;
  if(distance>weapon.range)return -Infinity;
  const mode=weapon.fireMode;
  const interval=mode==="burst"?weapon.fireIntervalMs/(weapon.burstCount??1):weapon.fireIntervalMs;
  const dps=weapon.damage*weapon.pellets*1000/interval;
  const ideal=weapon.model==="melee"?2:weapon.pellets>1?9:weapon.range>=200?60:weapon.range<=100?22:40;
  const suitability=1/(1+Math.abs(distance-ideal)/Math.max(10,ideal));
  const precision=distance>30?1/(1+weapon.spread*distance*2):1;
  const chargePenalty=mode==="charge"&&distance<12?.35:1;
  return dps*suitability*precision*chargePenalty*(item.magazine===0?.65:1);
}
export function brBotWeaponSlot(inventory:Array<BrInventoryItem|null>,ammo:BrAmmoState,distance:number):number {
  let slot=-1,score=-Infinity;
  for(let index=0;index<inventory.length;index++){const next=brBotWeaponScore(inventory[index],ammo,distance);if(next>score){slot=index;score=next;}}
  return slot;
}

function role(item:BrInventoryItem):string {
  if(!isBrWeapon(item.itemId))return "supply";
  const weapon=brWeaponStats(item.itemId,item.rarity);
  return weapon.model==="melee"?"melee":weapon.model==="projectile"?"area":weapon.fireMode==="beam"?"tracking":weapon.pellets>1||weapon.range<100?"close":weapon.range>=200?"precision":"general";
}
/** Deliberate upgrades and complementary roles, rather than filling five
 * inventory slots with the first five rifles encountered. */
export function brBotLootPlan(inventory:Array<BrInventoryItem|null>,ammo:BrAmmoState,loot:BrLootState,distance=35):{replaceSlot?:number}|null {
  if(!loot.itemId||!isBrWeapon(loot.itemId))return brPickupDisposition(inventory,ammo,loot)==="collect"?{}:null;
  const candidate:BrInventoryItem={instanceId:loot.id,itemId:loot.itemId,rarity:loot.rarity,count:1,magazine:loot.magazine??0};
  const score=brBotWeaponScore(candidate,ammo,distance);
  if(!Number.isFinite(score))return null;
  const weapons=inventory.flatMap((item,index)=>item&&isBrWeapon(item.itemId)?[{item,index}]:[]);
  const same=weapons.find(entry=>entry.item.itemId===candidate.itemId);
  if(same)return score>brBotWeaponScore(same.item,ammo,distance)*1.001?{replaceSlot:same.index}:null;
  const similar=weapons.filter(entry=>role(entry.item)===role(candidate));
  const replacePool=similar.length?similar:weapons.length>=3?weapons:[];
  if(replacePool.length){
    const worst=replacePool.reduce((a,b)=>brBotWeaponScore(a.item,ammo,distance)<brBotWeaponScore(b.item,ammo,distance)?a:b);
    return score>brBotWeaponScore(worst.item,ammo,distance)*1.08?{replaceSlot:worst.index}:null;
  }
  return inventory.some(item=>item===null)?{}:null;
}
