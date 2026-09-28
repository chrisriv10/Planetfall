import { describe, expect, it } from "vitest";
import { BR_HEALS, BR_WEAPONS } from "@planetfall/shared";
import { brItemArtLabel, brItemIconSvg, type BrItemArtId } from "./br-item-art";

const ids = [...Object.keys(BR_WEAPONS), ...Object.keys(BR_HEALS), "ammo-light", "ammo-heavy", "ammo-plasma"] as BrItemArtId[];
describe("canonical BR item art", () => {
  it("covers all seven weapons, four heals and three ammo silhouettes with one fixed canvas", () => {
    expect(ids).toHaveLength(14);
    const icons = ids.map(id => brItemIconSvg(id));
    expect(new Set(icons).size).toBe(14);
    for (const [index, icon] of icons.entries()) {
      expect(icon).toContain('viewBox="0 0 96 56"');
      expect(icon).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).toContain('focusable="false"');
      expect(icon.length).toBeLessThan(1400);
      expect(brItemIconSvg(ids[index])).toBe(icon);
      expect(icon).not.toMatch(/<script|<image|<filter|<foreignObject|href=|\bid=|\bon\w+=/i);
    }
  });
  it("uses canonical names and supports accessible standalone art without duplicating visible labels", () => {
    for (const id of ids) {
      const label = brItemArtLabel(id);
      expect(label.length).toBeGreaterThan(5);
      expect(brItemIconSvg(id, false)).toContain(`role="img" aria-label="${label}"`);
      expect(brItemIconSvg(id)).not.toContain('role="img"');
    }
    expect(brItemArtLabel("rail-laser")).toBe(BR_WEAPONS["rail-laser"].name);
    expect(brItemArtLabel("shield-battery")).toBe(BR_HEALS["shield-battery"].name);
    expect(brItemArtLabel("ammo-heavy")).toBe("HEAVY CELLS");
  });
});
