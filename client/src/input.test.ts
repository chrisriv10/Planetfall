import { describe, expect, it } from "vitest";
import { EdgeTracker, curveStick, radialDeadzone, responseCurve } from "./input";

describe("controller input math", () => {
  it("applies a radial deadzone and rescales the remaining range", () => {
    expect(radialDeadzone(.08, .08, .14)).toEqual({ x: 0, y: 0, magnitude: 0 });
    const result = radialDeadzone(.5, 0, .14);
    expect(result.x).toBeCloseTo((.5 - .14) / .86);
    expect(result.y).toBe(0);
  });

  it("preserves direction and full-stick magnitude", () => {
    const result = radialDeadzone(.6, .8, .14);
    expect(result.magnitude).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(.6);
    expect(result.y).toBeCloseTo(.8);
  });

  it("curves small look input without reducing maximum turn", () => {
    expect(responseCurve(.35)).toBeLessThan(.35);
    expect(responseCurve(-1)).toBe(-1);
    const diagonal = curveStick(.4, .4);
    expect(diagonal.x / diagonal.y).toBeCloseTo(1);
  });

  it("distinguishes pressed, held, and released edges", () => {
    const tracker = new EdgeTracker<"jump">();
    expect(tracker.update(["jump"]).pressed.has("jump")).toBe(true);
    expect(tracker.update(["jump"]).pressed.has("jump")).toBe(false);
    expect(tracker.update([]).released.has("jump")).toBe(true);
  });
});
