import {
  BR_WEAPONS, brFloorHeightAt, brItemMagazine, isBrHeal, seededRandom,
  type BrItemId, type BrLootSocket, type BrLootState, type BrWeaponId,
  BR_GROUND_WEAPONS, BR_NORMAL_HEALS, BR_GROUND_RARITIES, BR_CONSUMABLE_RARITIES, brWeightedChoice,
  BR_UTILITY_WEIGHTS,BR_UTILITIES,isBrUtility,
} from "@planetfall/shared";
import type { BrLootPlacement } from "./br-loot-placement.js";

/** Seeded, authored-socket loot with one basic combat kit per enterable
 * structure. Randomness still changes weapon/heal/rarity outcomes, but never
 * produces a legitimate building containing only healing items. */
export function generateBrLoot(
  sockets: readonly BrLootSocket[],
  seed: number,
  idFactory: (kind: "loot" | "ammo") => string,
  place: (origin: BrLootSocket["position"], requested: BrLootSocket["position"]) => BrLootPlacement = (_origin, position) => {
    const surfaceY=brFloorHeightAt(position,position.y);
    return {position:{...position,y:surfaceY+.58},surfaceY};
  },
): BrLootState[] {
  const random = seededRandom(seed);
  const seenStructures = new Set<string>();
  const lastItemByStructure = new Map<string, BrItemId>();
  const output: BrLootState[] = [];
  for (const socket of sockets) {
    const primary = !seenStructures.has(socket.structureId);
    seenStructures.add(socket.structureId);
    const chooseWeapon = primary || socket.kind === "roof" ? true : random() < .48;
    const pool = chooseWeapon ? BR_GROUND_WEAPONS : random()<.15?BR_UTILITY_WEIGHTS:BR_NORMAL_HEALS;
    let itemId:BrItemId = brWeightedChoice<BrItemId>(pool,random);
    const previous = lastItemByStructure.get(socket.structureId);
    if (itemId === previous && pool.length > 1) itemId = brWeightedChoice<BrItemId>(pool.filter(([candidate])=>candidate!==previous),random);
    lastItemByStructure.set(socket.structureId, itemId);
    const item: BrLootState = {
      id: idFactory("loot"), itemId, rarity: isBrUtility(itemId)?BR_UTILITIES[itemId].rarity:isBrHeal(itemId)?BR_CONSUMABLE_RARITIES[itemId]:brWeightedChoice(BR_GROUND_RARITIES,random),
      count: isBrHeal(itemId) ? 1 + Math.floor(random() * 2) : 1,
      magazine: brItemMagazine(itemId),
      ...place(socket.position,{ x: socket.position.x + (random() - .5) * .8, y: socket.position.y, z: socket.position.z + (random() - .5) * .8 }),
    };
    output.push(item);
    if (itemId in BR_WEAPONS) {
      const ammoType = BR_WEAPONS[itemId as BrWeaponId].ammo;
      if (ammoType && (primary || random() < .78)) output.push({
        id: idFactory("ammo"), ammoType, rarity: "common",
        count: ammoType === "light" ? 36 : ammoType === "heavy" ? 12 : 8,
        ...place(item.position,{ x: item.position.x + .95, y: item.position.y, z: item.position.z - .72 }),
      });
    }
  }
  return output;
}
