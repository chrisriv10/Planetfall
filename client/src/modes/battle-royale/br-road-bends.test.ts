import { describe, expect, it } from "vitest";
import { BR_ROADS, brAuthoredDeckHeight, isInsideBrIslandInterior, type BrRoadSegment } from "@planetfall/shared";
import { buildBrRoadBends } from "./br-road-bends";
const a:BrRoadSegment={id:"a",from:{x:-30,y:.1,z:0},to:{x:0,y:.1,z:0},width:8,color:"#000"};
const b:BrRoadSegment={...a,id:"b",from:a.to,to:{x:0,y:.1,z:30}};

describe("supported level road curves",()=>{
  it("uses circular outer caps and tangential inside fillets at a right-angle elbow",()=>{
    const [bend]=buildBrRoadBends([a,b],()=>0,[]);
    expect(bend.vertices).toHaveLength(24);expect(bend.insideFans).toHaveLength(8);
    for(const vertex of bend.vertices)expect(Math.hypot(vertex.x,vertex.z)).toBeCloseTo(4);
    expect(bend.edge[0].x).toBeCloseTo(-4);expect(bend.edge[0].z).toBeCloseTo(9.2);
    expect(bend.edge.at(-1)!.x).toBeCloseTo(-9.2);
    expect(bend.edge.at(-1)!.z).toBeCloseTo(4);
    const middle=bend.edge[4];expect(middle.x).toBeLessThan(-4);expect(middle.z).toBeGreaterThan(4);
    for(const triangle of bend.insideFans){
      const [p,q,r]=triangle;expect((q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x)).toBeGreaterThan(0);
    }
  });
  it("keeps grades and retaining edges out of decorative curve construction",()=>{
    expect(buildBrRoadBends([a,{...b,to:{...b.to,y:5}}],()=>0,[])).toEqual([]);
    expect(buildBrRoadBends([a,b],p=>p.x>1?5:0,[])).toEqual([]);
  });
  it("places the real network's curve vertices on the existing supporting floor",()=>{
    const bends=buildBrRoadBends(BR_ROADS);expect(bends.length).toBeGreaterThan(10);
    for(const bend of bends)for(const p of [...bend.vertices,...bend.insideFans.flat()]){
      expect(brAuthoredDeckHeight(p),bend.id).toBeCloseTo(p.y-.035,5);
      expect(isInsideBrIslandInterior(p),bend.id).toBe(true);
    }
  });
});
