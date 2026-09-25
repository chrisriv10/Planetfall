import { describe, expect, it } from "vitest";
import { classicSpectatorCycleDirection, classicSpectatorPrompt } from "./classic-spectator";

const idle = {
  previousPressed: false,
  nextPressed: false,
  repairPressed: false,
  menuX: 0 as const,
  menuY: 0 as const
};

describe("Classic spectator controls", () => {
  it("cycles with the vertical arrow/menu axis", () => {
    expect(classicSpectatorCycleDirection({ ...idle, menuY: -1 })).toBe(-1);
    expect(classicSpectatorCycleDirection({ ...idle, menuY: 1 })).toBe(1);
  });

  it("preserves wheel and gamepad cycle actions", () => {
    expect(classicSpectatorCycleDirection({ ...idle, previousPressed: true })).toBe(-1);
    expect(classicSpectatorCycleDirection({ ...idle, nextPressed: true })).toBe(1);
    expect(classicSpectatorCycleDirection({ ...idle, repairPressed: true })).toBe(1);
  });

  it("shows one wheel label plus arrow-key guidance", () => {
    const prompt = classicSpectatorPrompt("Nova", "keyboard");
    expect(prompt).toBe("SPECTATING NOVA  ·  WHEEL / ↑↓ CYCLE");
    expect(prompt.match(/WHEEL/g)).toHaveLength(1);
    expect(classicSpectatorPrompt("Orbit", "gamepad")).toContain("LB / RB");
  });
});
