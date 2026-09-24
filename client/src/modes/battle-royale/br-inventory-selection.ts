import type { BrInventoryItem } from "@planetfall/shared";

/** Cycles through occupied BR slots. Direct number-key selection remains free
 * to choose an empty slot for deliberate swaps and pickups. */
export function nextOccupiedBrSlot(
  inventory: readonly (BrInventoryItem | null)[],
  current: number,
  direction: -1 | 1
): number {
  if (!Number.isInteger(current) || !inventory.length) return current;
  for (let step = 1; step <= inventory.length; step++) {
    const slot = (current + direction * step + inventory.length * 2) % inventory.length;
    if (inventory[slot]) return slot;
  }
  return current;
}
