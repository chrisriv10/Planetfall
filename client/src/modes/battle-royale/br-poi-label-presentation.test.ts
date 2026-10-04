import { describe, expect, it } from "vitest";
import { brPoiLabelPresentation } from "./br-poi-label-presentation";

const label = { x: 0, y: 40, z: 0 };

describe("BR POI label presentation", () => {
  it("yields to authored facade signs near a grounded player", () => {
    expect(brPoiLabelPresentation({ x: 0, y: 1, z: 60 }, label, { x: 0, y: 5, z: 66 }, false).visible).toBe(false);
    expect(brPoiLabelPresentation({ x: 0, y: 1, z: 100 }, label, { x: 0, y: 5, z: 106 }, false).visible).toBe(true);
  });

  it("remains available during a useful airborne approach without covering arrival", () => {
    expect(brPoiLabelPresentation({ x: 0, y: 90, z: 58 }, label, { x: 0, y: 94, z: 65 }, true).visible).toBe(false);
    expect(brPoiLabelPresentation({ x: 0, y: 90, z: 70 }, label, { x: 0, y: 94, z: 76 }, true).visible).toBe(true);
  });

  it("uses bounded scale and opacity across normal navigation distances", () => {
    const near = brPoiLabelPresentation({ x: 100, y: 1, z: 0 }, label, { x: 100, y: 5, z: 0 }, false);
    const far = brPoiLabelPresentation({ x: 700, y: 1, z: 0 }, label, { x: 700, y: 150, z: 0 }, true);
    expect(near).toMatchObject({ visible: true, scale: 6.5 });
    expect(near.opacity).toBeGreaterThanOrEqual(.2);
    expect(far.visible).toBe(true);
    expect(far.scale).toBe(12.5);
    expect(far.opacity).toBe(.82);
  });

  it("hides beyond the navigation horizon and fails closed for invalid input", () => {
    expect(brPoiLabelPresentation({ x: 900, y: 1, z: 0 }, label, { x: 900, y: 1, z: 0 }, false).visible).toBe(false);
    expect(brPoiLabelPresentation(undefined, { x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true)).toEqual({ visible: false, opacity: 0, scale: 0 });
  });
});
