import { describe, expect, it } from "vitest";
import type { BrRoadSegment, BrStructure } from "@planetfall/shared";
import { buildBrVisibleRoadSpans } from "./br-road-surfaces";

const road: BrRoadSegment = { id: "road", from: { x: -20, y: 0, z: 0 }, to: { x: 20, y: 0, z: 0 }, width: 8, color: "#000" };
const structure: BrStructure = { id: "building", districtId: "test", position: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 8, z: 10 }, style:"city",floors: 1, entrance:"south",roofAccess:false,enterable: false, color: "#fff", archetype: "shop" };

describe("BR visible road spans", () => {
  it("cuts visual paving out of authored building footprints", () => {
    const spans = buildBrVisibleRoadSpans(road, [structure], 0);
    expect(spans).toHaveLength(2);
    expect(spans[0].to.x).toBeCloseTo(-9);
    expect(spans[1].from.x).toBeCloseTo(9);
  });

  it("leaves unobstructed roads intact", () => {
    expect(buildBrVisibleRoadSpans(road, [])).toEqual([expect.objectContaining({ startT: 0, endT: 1, from: {x:road.from.x,z:road.from.z}, to: {x:road.to.x,z:road.to.z} })]);
  });
});
