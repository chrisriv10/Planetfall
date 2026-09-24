import { describe, expect, it } from "vitest";
import type { BrInventoryItem } from "@planetfall/shared";
import { nextOccupiedBrSlot } from "./br-inventory-selection";

const item = (instanceId: string): BrInventoryItem => ({
  instanceId,
  itemId: "pulse-rifle",
  rarity: "common",
  count: 1,
  magazine: 1
});

describe("BR occupied inventory cycling", () => {
  it("skips empty slots in both directions and wraps", () => {
    const inventory = [item("a"), null, null, item("b"), null];
    expect(nextOccupiedBrSlot(inventory, 0, 1)).toBe(3);
    expect(nextOccupiedBrSlot(inventory, 3, 1)).toBe(0);
    expect(nextOccupiedBrSlot(inventory, 0, -1)).toBe(3);
    expect(nextOccupiedBrSlot(inventory, 3, -1)).toBe(0);
  });

  it("keeps the current slot when it is the only occupied choice", () => {
    expect(nextOccupiedBrSlot([null, null, item("only"), null, null], 2, 1)).toBe(2);
    expect(nextOccupiedBrSlot([null, null, item("only"), null, null], 2, -1)).toBe(2);
  });

  it("finds an occupied slot when the current slot is empty", () => {
    expect(nextOccupiedBrSlot([null, null, item("next"), null, null], 0, 1)).toBe(2);
    expect(nextOccupiedBrSlot([null, null, item("previous"), null, null], 0, -1)).toBe(2);
  });

  it("does not invent a selection for an empty or malformed inventory", () => {
    expect(nextOccupiedBrSlot([null, null, null], 1, 1)).toBe(1);
    expect(nextOccupiedBrSlot([], 0, 1)).toBe(0);
    expect(Number.isNaN(nextOccupiedBrSlot([item("a")], Number.NaN, 1))).toBe(true);
  });
});
