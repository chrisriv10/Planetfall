import { describe, expect, it } from "vitest";
import { ReconciliationTracker, interpolationAlpha, shouldAcceptSnapshot } from "./reconciliation.js";

describe("snapshot hardening", () => {
  it("ignores stale, duplicate, and invalid snapshot timestamps", () => {
    expect(shouldAcceptSnapshot(Number.NEGATIVE_INFINITY, 1000)).toBe(true);
    expect(shouldAcceptSnapshot(1000, 1001)).toBe(true);
    expect(shouldAcceptSnapshot(1000, 1000)).toBe(false);
    expect(shouldAcceptSnapshot(1000, 999)).toBe(false);
    expect(shouldAcceptSnapshot(1000, Number.NaN)).toBe(false);
  });

  it("uses bounded monotonic interpolation without overshoot", () => {
    const slow = interpolationAlpha(1 / 60, 8);
    const fast = interpolationAlpha(1 / 30, 13);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThan(1);
    let position = 0;
    for (let frame = 0; frame < 180; frame++) {
      const previous = position;
      position += (10 - position) * interpolationAlpha(1 / 60, 8);
      expect(position).toBeGreaterThanOrEqual(previous);
      expect(position).toBeLessThanOrEqual(10);
    }
    expect(position).toBeCloseTo(10, 6);
  });

  it("reports finite rolling reconciliation metrics", () => {
    const tracker = new ReconciliationTracker();
    [0.1, 0.2, 0.4, 5].forEach((error, index) => tracker.record(error, error >= 4.5, 1000 + index * 1000));
    tracker.record(Number.NaN, true, 5000);
    const result = tracker.summary(5000, 60_000);
    expect(result.averageCorrection).toBeCloseTo(1.425);
    expect(result.p95Correction).toBe(5);
    expect(result.maximumCorrection).toBe(5);
    expect(result.snapCount).toBe(1);
    expect(result.correctionCount).toBe(4);
    expect(result.correctionsPerMinute).toBe(60);
    tracker.reset();
    expect(tracker.summary(6000).correctionCount).toBe(0);
  });
});
