import { describe, expect, it } from "vitest";
import { brDamageNumberScreenScale } from "./br-damage-numbers";
describe("damage number screen size", () => {
  it("keeps distant numeric glyphs readable across FOV and viewport heights", () => {
    for(const depth of [80,170,360])for(const fov of [50,75,90])for(const height of [720,1080]){
      const scale=brDamageNumberScreenScale(depth,fov,height);
      const pixels=.78*scale*.5*height/(2*depth*Math.tan(fov*Math.PI/360));
      expect(pixels).toBeGreaterThanOrEqual(26-1e-8);
    }
  });
  it("preserves near size, rejects invalid inputs, and bounds distant growth", () => {
    expect(brDamageNumberScreenScale(1,75,1080)).toBe(1);
    expect(brDamageNumberScreenScale(Infinity,75,1080)).toBe(1);
    expect(brDamageNumberScreenScale(-1,75,1080)).toBe(1);
    expect(brDamageNumberScreenScale(100,75,0)).toBe(1);
    expect(brDamageNumberScreenScale(9000,75,1080)).toBe(brDamageNumberScreenScale(360,75,1080));
  });
});
