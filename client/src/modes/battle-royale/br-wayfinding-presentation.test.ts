import { describe, expect, it } from "vitest";
import {
  BR_WAYFINDING_NEAR_HIDDEN_DISTANCE, BR_WAYFINDING_NEAR_VISIBLE_DISTANCE,
  BR_WAYFINDING_FAR_VISIBLE_DISTANCE, BR_WAYFINDING_FAR_HIDDEN_DISTANCE,
  brWayfindingOpacity,
} from "./br-wayfinding-presentation";

describe("route billboard opacity", () => {
  it("hides invalid distances and nearby oversized billboards", () => {
    for (const distance of [NaN, Infinity, -Infinity, -1, -Number.MAX_VALUE, 0, .68, 17.99, 18, 200, 201, Number.MAX_VALUE]) {
      expect(brWayfindingOpacity(distance)).toBe(0);
    }
  });
  it("retains the navigation plateau and named metre boundaries", () => {
    expect([BR_WAYFINDING_NEAR_HIDDEN_DISTANCE, BR_WAYFINDING_NEAR_VISIBLE_DISTANCE,
      BR_WAYFINDING_FAR_VISIBLE_DISTANCE, BR_WAYFINDING_FAR_HIDDEN_DISTANCE]).toEqual([18, 32, 160, 200]);
    for (const distance of [32, 60, 100, 159.99, 160]) expect(brWayfindingOpacity(distance)).toBe(1);
    expect(brWayfindingOpacity(25)).toBe(.5);
    expect(brWayfindingOpacity(180)).toBe(.5);
    // Quarter-fade values distinguish eased fades from linear ramps.
    expect(brWayfindingOpacity(21.5)).toBe(.15625);
    expect(brWayfindingOpacity(170)).toBe(.84375);
  });
  it("fades monotonically without leaving the opacity range", () => {
    let near = 0, far = 1;
    for (let step = 0; step <= 400; step++) {
      const a = brWayfindingOpacity(18 + 14 * step / 400);
      const b = brWayfindingOpacity(160 + 40 * step / 400);
      expect(a).toBeGreaterThanOrEqual(near); expect(a).toBeLessThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(far); expect(b).toBeGreaterThanOrEqual(0);
      near = a; far = b;
    }
  });
  it("joins hidden and fully visible regions continuously with zero boundary slope", () => {
    const delta = .0001;
    for (const boundary of [18, 32, 160, 200]) {
      const center = brWayfindingOpacity(boundary);
      for (const side of [-1, 1]) {
        const difference = Math.abs(brWayfindingOpacity(boundary + side * delta) - center);
        expect(difference).toBeLessThan(1e-8);
        expect(difference / delta).toBeLessThan(.00001);
      }
    }
  });
});
