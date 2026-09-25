import {
  BR_HEALS, BR_WEAPONS, brItemMagazine, isBrHeal, seededRandom,
  type BrItemId, type BrLootSocket, type BrLootState, type BrRarity, type BrWeaponId,
} from "@planetfall/shared";

const WEAPONS = Object.keys(BR_WEAPONS) as BrWeaponId[];
const HEALS = Object.keys(BR_HEALS) as BrItemId[];

function rarity(random: () => number): BrRarity {
  const roll = random();
  return roll > .97 ? "legendary" : roll > .84 ? "epic" : roll > .48 ? "rare" : "common";
}

/** Seeded, authored-socket loot with one basic combat kit per enterable
 * structure. Randomness still changes weapon/heal/rarity outcomes, but never
 * produces a legitimate building containing only healing items. */
export function generateBrLoot(
  sockets: readonly BrLootSocket[],
  seed: number,
  idFactory: (kind: "loot" | "ammo") => string,
): BrLootState[] {
  const random = seededRandom(seed);
  const seenStructures = new Set<string>();
  const lastItemByStructure = new Map<string, BrItemId>();
  const output: BrLootState[] = [];
  for (const socket of sockets) {
    const primary = !seenStructures.has(socket.structureId);
    seenStructures.add(socket.structureId);
    const chooseWeapon = primary || socket.kind === "roof" ? true : random() < .48;
    let pool = chooseWeapon ? WEAPONS : HEALS;
    let itemId = pool[Math.floor(random() * pool.length)];
    const previous = lastItemByStructure.get(socket.structureId);
    if (itemId === previous && pool.length > 1) itemId = pool[(pool.indexOf(itemId) + 1 + Math.floor(random() * (pool.length - 1))) % pool.length];
    lastItemByStructure.set(socket.structureId, itemId);
    const surfaceY = socket.position.y - (socket.kind === "roof" ? .65 : .58);
    const item: BrLootState = {
      id: idFactory("loot"), itemId, rarity: rarity(random),
      count: isBrHeal(itemId) ? 1 + Math.floor(random() * 2) : 1,
      magazine: brItemMagazine(itemId),
      position: { x: socket.position.x + (random() - .5) * .8, y: socket.position.y, z: socket.position.z + (random() - .5) * .8 },
      surfaceY,
    };
    output.push(item);
    if (itemId in BR_WEAPONS) {
      const ammoType = BR_WEAPONS[itemId as BrWeaponId].ammo;
      if (ammoType && (primary || random() < .78)) output.push({
        id: idFactory("ammo"), ammoType, rarity: "common",
        count: ammoType === "light" ? 36 : ammoType === "heavy" ? 12 : 8,
        position: { x: item.position.x + .95, y: socket.position.y, z: item.position.z - .72 }, surfaceY,
      });
    }
  }
  return output;
}
