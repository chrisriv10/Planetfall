import { BR_HEALS, BR_RARITY_MULTIPLIER, BR_WEAPONS } from "./balance.js";
import type { BrAmmoState, BrHealId, BrInventoryItem, BrItemId, BrLootState, BrRarity, BrWeaponId } from "./types.js";

export function isBrWeapon(itemId: BrItemId): itemId is BrWeaponId { return itemId in BR_WEAPONS; }
export function isBrHeal(itemId: BrItemId): itemId is BrHealId { return itemId in BR_HEALS; }
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
  if (isBrHeal(itemId) && inventory.some(item=>item?.itemId===itemId && item.count<BR_HEALS[itemId].maxStack)) return "collect";
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
