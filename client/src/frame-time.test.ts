import { expect, it } from "vitest";
import { frameDeltaSeconds } from "./frame-time";

it("does not reverse camera interpolation when activation postdates the current RAF", () => {
  expect(frameDeltaSeconds(100, 9000)).toBe(0);
  expect(frameDeltaSeconds(9016, 9000)).toBe(.016);
  expect(frameDeltaSeconds(16000, 9000)).toBe(.05);
  expect(frameDeltaSeconds(Number.NaN, 9000)).toBe(0);
  expect(frameDeltaSeconds(9016, Number.POSITIVE_INFINITY)).toBe(0);
});
