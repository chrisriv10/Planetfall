import { describe, expect, it } from "vitest";
import { resolveBrOptimisticSelection } from "./br-optimistic-selection";

describe("BR optimistic selections", () => {
  it("holds a local choice across stale snapshots", () => {
    const pending = { value: 3, expiresAt: 1_500 };
    expect(resolveBrOptimisticSelection(1, pending, 1_000)).toEqual({ value: 3, pending });
  });

  it("clears when the server acknowledges the choice", () => {
    expect(resolveBrOptimisticSelection(3, { value: 3, expiresAt: 1_500 }, 1_000)).toEqual({ value: 3, pending: null });
  });

  it("returns to authority after the bounded grace period", () => {
    expect(resolveBrOptimisticSelection("old", { value: "new", expiresAt: 1_500 }, 1_500)).toEqual({ value: "old", pending: null });
  });
});
