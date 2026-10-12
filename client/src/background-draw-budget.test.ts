import { describe, expect, it, vi } from "vitest";
import { BackgroundDrawBudget } from "./background-draw-budget";
import { PlanetfallGame } from "./game";

describe("BR overview draw budget", () => {
  it("leaves frequent UI updates between slow software-rendered frames", () => {
    const budget = new BackgroundDrawBudget();
    expect(budget.drawDue(0, true)).toBe(true);
    expect(budget.drawDue(430, true)).toBe(true);
    // The second expensive draw establishes a 600ms bounded budget. Every
    // intervening RAF still executes the caller's input and room/UI work.
    for (let now = 860; now < 1030; now += 16) expect(budget.drawDue(now, true)).toBe(false);
    expect(budget.drawDue(1030, true)).toBe(true);
  });

  it("keeps animating on fast hardware without consuming every input frame", () => {
    const budget = new BackgroundDrawBudget();
    let draws = 0;
    for (let now = 0; now < 1000; now += 10) if (budget.drawDue(now, true)) draws++;
    expect(draws).toBe(20);
  });

  it("never limits gameplay or Classic and discards stale overview cost", () => {
    const budget = new BackgroundDrawBudget();
    budget.drawDue(0, true); budget.drawDue(450, true);
    for (let now = 460; now <= 490; now++) expect(budget.drawDue(now, false)).toBe(true);
    expect(budget.drawDue(491, true)).toBe(true);
    expect(budget.drawDue(507, true)).toBe(false);
    expect(budget.drawDue(541, true)).toBe(true);
  });

  it("the actual frame loop still services input, scenery updates and physics when a draw is skipped", () => {
    const game = Object.assign(Object.create(PlanetfallGame.prototype), {
      lastFrame: 0, demoTime: 0, mode: "home", homeFamily: "battle-royale",
      input: { sample: vi.fn(() => ({})) }, processControls: vi.fn(),
      starLayers: [], updateDemo: vi.fn(), updateEffects: vi.fn(),
      physics: { step: vi.fn() }, renderer: { render: vi.fn() },
      backgroundDrawBudget: new BackgroundDrawBudget(),
      performanceFrames: 0, performanceSampleAt: 0
    });
    for (const now of [0, 16, 32, 50]) game.frame(now);
    expect(game.renderer.render).toHaveBeenCalledTimes(2);
    for (const update of [game.input.sample, game.processControls, game.updateDemo, game.updateEffects, game.physics.step]) {
      expect(update).toHaveBeenCalledTimes(4);
    }
    expect(game.performanceFrames).toBe(2);
  });
});
