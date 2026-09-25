import { describe, expect, it } from "vitest";
import { useBrPlayerImpostor } from "./br-player-lod";

describe("BR remote-player LOD", () => {
  it("batches only distant grounded remote players", () => {
    expect(useBrPlayerImpostor(90, "high", false, "grounded", false)).toBe(true);
    expect(useBrPlayerImpostor(60, "high", false, "grounded", false)).toBe(false);
    expect(useBrPlayerImpostor(90, "high", true, "grounded", false)).toBe(false);
    expect(useBrPlayerImpostor(90, "high", false, "chute", false)).toBe(false);
    expect(useBrPlayerImpostor(90, "high", false, "grounded", true)).toBe(false);
  });

  it("uses progressively cheaper thresholds for lower presets", () => {
    expect(useBrPlayerImpostor(40, "low", false, "grounded", false)).toBe(true);
    expect(useBrPlayerImpostor(40, "medium", false, "grounded", false)).toBe(false);
  });
});
