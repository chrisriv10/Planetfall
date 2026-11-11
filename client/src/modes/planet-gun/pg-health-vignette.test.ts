import { describe, expect, it, vi } from "vitest";
import { createPgHealthVignette, pgHealthVignetteStyle } from "./pg-health-vignette";

describe("health border presentation", () => {
  it("increases intensity and extent continuously while preserving the central half", () => {
    let previous = pgHealthVignetteStyle(1);
    expect(previous.opacity).toBe(0);
    for (const hp of [.9, .75, .5, .25, .1, 0]) {
      const style = pgHealthVignetteStyle(hp);
      expect(style.opacity).toBeGreaterThan(previous.opacity);
      expect(style.extentVmin).toBeGreaterThan(previous.extentVmin);
      expect(style.extentVmin).toBeLessThan(25);
      expect(style.opacity).toBeLessThanOrEqual(.76);
      previous = style;
    }
    expect(pgHealthVignetteStyle(.1).opacity).toBeGreaterThan(.65);
  });
  it("hides inactive and invalid input and clamps out-of-range ratios", () => {
    for (const hp of [null, NaN, Infinity, 1, 2]) expect(pgHealthVignetteStyle(hp).opacity).toBe(0);
    expect(pgHealthVignetteStyle(-1)).toEqual(pgHealthVignetteStyle(0));
  });
  it("owns only a decorative element and cannot update after disposal", () => {
    const node = { className: "", hidden: false, setAttribute: vi.fn(), remove: vi.fn(),
      style: { opacity: "", setProperty: vi.fn() } };
    const parent = { append: vi.fn(), ownerDocument: { createElement: () => node } } as unknown as HTMLElement;
    const view = createPgHealthVignette(parent);
    expect(node.hidden).toBe(true);
    expect(node.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");
    view.set(.25);
    expect(node.hidden).toBe(false);
    expect(Number(node.style.opacity)).toBeGreaterThan(.5);
    view.set(null);
    expect(node.hidden).toBe(true);
    view.dispose();
    view.set(.1);
    expect(node.hidden).toBe(true);
    expect(node.remove).toHaveBeenCalledOnce();
    expect(parent.append).toHaveBeenCalledOnce();
  });
});
