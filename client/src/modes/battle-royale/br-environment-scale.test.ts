import { describe, expect, it } from "vitest";
import {
  BR_ASTRONAUT_REFERENCE_HEIGHT,
  BR_ENVIRONMENT_SCALE,
  isWithinBrPresentationScale,
} from "./br-environment-scale";

describe("BR environment presentation scale", () => {
  it("keeps human-scale furniture proportional to the canonical astronaut", () => {
    expect(BR_ASTRONAUT_REFERENCE_HEIGHT).toBe(2);
    expect(BR_ENVIRONMENT_SCALE.benchSeatTop.max / BR_ASTRONAUT_REFERENCE_HEIGHT).toBeLessThan(.3);
    expect(BR_ENVIRONMENT_SCALE.cafeTableTop.max / BR_ASTRONAUT_REFERENCE_HEIGHT).toBeLessThan(.55);
    expect(BR_ENVIRONMENT_SCALE.entranceClearHeight.min).toBeGreaterThan(BR_ASTRONAUT_REFERENCE_HEIGHT);
  });

  it("accepts deliberate stylisation but rejects the observed overscale seats", () => {
    expect(isWithinBrPresentationScale(.52, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(true);
    expect(isWithinBrPresentationScale(.68, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(false);
    expect(isWithinBrPresentationScale(.50, BR_ENVIRONMENT_SCALE.cafeSeatTop)).toBe(true);
    expect(isWithinBrPresentationScale(.59, BR_ENVIRONMENT_SCALE.cafeSeatTop)).toBe(false);
    expect(isWithinBrPresentationScale(Number.NaN, BR_ENVIRONMENT_SCALE.benchSeatTop)).toBe(false);
  });

  it("bounds readable trees, lights, entrances and one-seat transports", () => {
    expect(isWithinBrPresentationScale(4.7, BR_ENVIRONMENT_SCALE.ornamentalTreeHeight)).toBe(true);
    expect(isWithinBrPresentationScale(3.2, BR_ENVIRONMENT_SCALE.streetLightHeight)).toBe(true);
    expect(isWithinBrPresentationScale(3, BR_ENVIRONMENT_SCALE.entranceClearHeight)).toBe(true);
    expect(isWithinBrPresentationScale(2.2, BR_ENVIRONMENT_SCALE.oneSeatTransportWidth)).toBe(true);
    expect(isWithinBrPresentationScale(4.4, BR_ENVIRONMENT_SCALE.oneSeatTransportLength)).toBe(true);
    expect(isWithinBrPresentationScale(1.8, BR_ENVIRONMENT_SCALE.oneSeatTransportHeight)).toBe(true);
  });
});

