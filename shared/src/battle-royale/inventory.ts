import { BR_HEALS, BR_RARITY_MULTIPLIER, BR_WEAPONS, type BrWeaponDefinition } from "./balance.js";
import type { BrAmmoState, BrHealId, BrUtilityId, BrInventoryItem, BrItemId, BrLootState, BrRarity, BrWeaponId } from "./types.js";
import {BR_UTILITIES} from "./utilities.js";
import { BR_RARITIES } from "./rarity.js";

const weaponStatsCache=new Map<string,BrWeaponDefinition>();
export function brWeaponStats(itemId:BrWeaponId,rarity:BrRarity):BrWeaponDefinition {
  const key=`${itemId}:${rarity}`,cached=weaponStatsCache.get(key);if(cached)return cached;
  const base:BrWeaponDefinition=BR_WEAPONS[itemId],profile=BR_RARITIES[rarity];
  const stats=Object.freeze({...base,damage:base.damage*profile.damage,reloadMs:Math.round(base.reloadMs*profile.reload),spread:base.spread*profile.spread,
    magazine:Math.round(base.magazine*profile.magazine),projectileSpeed:base.projectileSpeed===undefined?undefined:base.projectileSpeed*profile.projectileSpeed});
  weaponStatsCache.set(key,stats);return stats;
}

export function isBrWeapon(itemId: BrItemId): itemId is BrWeaponId { return itemId in BR_WEAPONS; }
export function isBrHeal(itemId: BrItemId): itemId is BrHealId { return itemId in BR_HEALS; }
export function isBrUtility(itemId:BrItemId):itemId is BrUtilityId{return itemId in BR_UTILITIES;}
export function brItemName(itemId:BrItemId):string {
  return isBrWeapon(itemId)?BR_WEAPONS[itemId].name:isBrHeal(itemId)?BR_HEALS[itemId].name:BR_UTILITIES[itemId].name;
}
export function brItemDescription(itemId:BrItemId,rarity:BrRarity):string {
  if(isBrUtility(itemId))return BR_UTILITIES[itemId].role;
  if(isBrHeal(itemId)){
    const heal=BR_HEALS[itemId];
    return `${heal.hp?`+${heal.hp} HP`:`+${heal.shield} SHIELD`} · ${(heal.durationMs/1000).toFixed(heal.durationMs%1000?1:0)}s USE`;
  }
  const weapon=brWeaponStats(itemId,rarity);
  if(weapon.fireMode==="beam")return `TRACKING BEAM · HEAT ${weapon.heatCapacity} · ${weapon.range}m`;
  if(weapon.fireMode==="charge")return `GRAVITY PROJECTILE · CHARGE ${(weapon.chargeMs??0)/1000}s`;
  const role=weapon.fireMode==="burst"?`${weapon.burstCount}-ROUND BURST`:weapon.role.toUpperCase();
  return `${role} · ${Number(weapon.damage.toFixed(1))} DMG · ${weapon.range}m`;
}
export function brItemMagazine(itemId: BrItemId): number { return isBrWeapon(itemId) ? BR_WEAPONS[itemId].magazine : 0; }
export function brRarityDamage(itemId: BrWeaponId, rarity: BrRarity): number { return BR_WEAPONS[itemId].damage * BR_RARITY_MULTIPLIER[rarity]; }
export function createEmptyBrInventory(): Array<BrInventoryItem | null> { return [null, null, null, null, null]; }
/** Shared capacity decision for contextual prompts and bot loot goals. The
 * server still validates range, ownership and the explicit replacement slot. */
export function brPickupDisposition(inventory: Array<BrInventoryItem | null>, ammo: BrAmmoState, loot: BrLootState): "collect" | "swap" | "full" {
  if (loot.ammoType) return ammo[loot.ammoType] < 999 ? "collect" : "full";
  if (!loot.itemId || loot.count <= 0) return "full";
  const itemId=loot.itemId;
  if (inventory.some(item=>item===null)) return "collect";
  const maxStack=isBrHeal(itemId)?BR_HEALS[itemId].maxStack:isBrUtility(itemId)?BR_UTILITIES[itemId].maxStack:1;
  if (maxStack>1 && inventory.some(item=>item?.itemId===itemId && item.count<maxStack)) return "collect";
  return "swap";
}
export function canReload(item: BrInventoryItem, ammo: BrAmmoState): boolean {
  if (!isBrWeapon(item.itemId)) return false;
  const weapon = BR_WEAPONS[item.itemId];
  return weapon.ammo !== null && item.magazine < weapon.magazine && ammo[weapon.ammo] > 0;
}
export function reloadBrItem(item: BrInventoryItem, ammo: BrAmmoState): number {
  if (!isBrWeapon(item.itemId)) return 0;
  const weapon = BR_WEAPONS[item.itemId];
  if (!weapon.ammo) return 0;
  const loaded = Math.min(weapon.magazine - item.magazine, ammo[weapon.ammo]);
  item.magazine += loaded;
  ammo[weapon.ammo] -= loaded;
  return loaded;
}
