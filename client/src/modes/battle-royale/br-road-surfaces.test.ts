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
    expect(buildBrVisibleRoadSpans(road, [])).toEqual([expect.objectContaining({ startT: 0, endT: 1, from: road.from, to: road.to })]);
  });

  it("preserves authored grade heights when a road is clipped",()=>{
    const graded={...road,from:{x:-20,y:5,z:0},to:{x:20,y:1,z:0}};
    const spans=buildBrVisibleRoadSpans(graded,[structure],0);
    expect(spans[0].from.y).toBe(5);
    expect(spans[0].to.y).toBeCloseTo(3.9);
    expect(spans[1].from.y).toBeCloseTo(2.1);
    expect(spans[1].to.y).toBe(1);
  });

  it("clips later coplanar road slabs at crossings instead of z-fighting",()=>{
    const vertical:BrRoadSegment={id:"vertical",from:{x:0,y:0,z:-20},to:{x:0,y:0,z:20},width:8,color:"#000"};
    const spans=buildBrVisibleRoadSpans(vertical,[],0,[road]);
    expect(spans).toHaveLength(2);
    expect(spans[0].to.z).toBeLessThanOrEqual(-3.9);
    expect(spans[1].from.z).toBeGreaterThanOrEqual(3.9);
  });

  it("does not clip an elevated bridge where roads cross on different levels",()=>{
    const bridge:BrRoadSegment={id:"bridge",from:{x:0,y:5,z:-20},to:{x:0,y:5,z:20},width:8,color:"#000"};
    expect(buildBrVisibleRoadSpans(bridge,[],0,[road])).toEqual([expect.objectContaining({startT:0,endT:1})]);
  });
});
