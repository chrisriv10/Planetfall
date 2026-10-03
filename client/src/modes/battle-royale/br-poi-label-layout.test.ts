import { describe, expect, it } from "vitest";
import { layoutBrPoiLabel, type BrPoiVisualBounds } from "./br-poi-label-layout";

describe("BR POI label layout", () => {
  it("preserves the established label size and baseline for unobstructed districts", () => {
    expect(layoutBrPoiLabel({ x: 24, y: 0, z: -18 })).toEqual({
      position: { x: 24, y: 38, z: -18 },
      scale: { x: 31, y: 9, z: 1 }
    });
    expect(layoutBrPoiLabel({ x: 24, y: 5.5, z: -18 }).position.y).toBe(43.5);
  });

  it("clears the actual landmark silhouette with a restrained three-metre margin", () => {
    const zeroBounds: BrPoiVisualBounds = {
      min: { x: -28, y: 0, z: -28 }, max: { x: 28, y: 56, z: 28 }
    };
    const layout = layoutBrPoiLabel({ x: 0, y: 0, z: 0 }, { landmarkBounds: zeroBounds });
    expect(layout.position.y).toBe(63.5);
    expect(layout.position.y - layout.scale.y / 2).toBe(59);
    expect(layout.position.y - layout.scale.y / 2 - zeroBounds.max.y).toBe(3);
  });

  it("uses the highest of the measured landmark and nearby authored structures", () => {
    const landmarkBounds: BrPoiVisualBounds = {
      min: { x: 250, y: 0, z: 65 }, max: { x: 274, y: 61, z: 91 }
    };
    const label = layoutBrPoiLabel({ x: 262, y: 0, z: 78 }, { landmarkBounds, nearbyStructureTop: 76 });
    expect(label.position.y).toBe(83.5);
    expect(label.position.y - label.scale.y / 2).toBe(79);
  });

  it("does not lower a label when measured geometry already clears the baseline", () => {
    const label = layoutBrPoiLabel({ x: -180, y: 0, z: -120 }, {
      landmarkBounds: { min: { x: -190, y: 0, z: -130 }, max: { x: -170, y: 18, z: -110 } },
      nearbyStructureTop: 27
    });
    expect(label.position.y).toBe(38);
  });

  it("fails safely for empty, inverted, non-finite and implausible bounds", () => {
    const origin = { x: 8, y: 4, z: 12 };
    const fallback = layoutBrPoiLabel(origin);
    for (const landmarkBounds of [
      { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } },
      { min: { x: 2, y: 8, z: 2 }, max: { x: 1, y: 7, z: 1 } },
      { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: Number.NaN, z: 1 } },
      { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1000, z: 1 } }
    ]) expect(layoutBrPoiLabel(origin, { landmarkBounds })).toEqual(fallback);
    expect(layoutBrPoiLabel(origin, { nearbyStructureTop: Number.NaN })).toEqual(fallback);
    expect(layoutBrPoiLabel(origin, { nearbyStructureTop: 1000 })).toEqual(fallback);
    expect(layoutBrPoiLabel({ x: Number.NaN, y: Infinity, z: -Infinity })).toEqual({
      position: { x: 0, y: 38, z: 0 }, scale: { x: 31, y: 9, z: 1 }
    });
  });

  it("is deterministic and does not mutate caller-owned measurements", () => {
    const origin = { x: 10, y: 2, z: 20 };
    const bounds: BrPoiVisualBounds = { min: { x: 2, y: 2, z: 12 }, max: { x: 18, y: 48, z: 28 } };
    const before = JSON.stringify([origin, bounds]);
    expect(layoutBrPoiLabel(origin, { landmarkBounds: bounds })).toEqual(layoutBrPoiLabel(origin, { landmarkBounds: bounds }));
    expect(JSON.stringify([origin, bounds])).toBe(before);
  });
});

