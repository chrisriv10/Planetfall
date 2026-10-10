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
  it.each([30,45,60,120])("makes tangential inside edges at a %s degree turn",degrees=>{
    const radians=degrees*Math.PI/180,next={...b,to:{x:30*Math.cos(radians),y:.1,z:30*Math.sin(radians)}};
    const [bend]=buildBrRoadBends([a,next],()=>0,[]);
    expect(bend.insideFans).toHaveLength(8);expect(bend.outerEdge).toHaveLength(9);
    const first=bend.edge[0],last=bend.edge.at(-1)!;
    expect(Math.abs(first.x*Math.sin(radians)-first.z*Math.cos(radians))).toBeCloseTo(4,8);
    expect(last.z).toBeCloseTo(4,8);
    const incoming={x:last.x-bend.edge.at(-2)!.x,z:last.z-bend.edge.at(-2)!.z};
    expect(Math.abs(incoming.z/incoming.x)).toBeLessThan(.14);
    for(const arm of bend.arms)expect(arm.tangent).toBeLessThanOrEqual(30*.45+1e-8);
  });
  it("bounds both tangencies on a short leg and rejects interior support holes",()=>{
    const next={...b,to:{x:6*Math.cos(Math.PI/4),y:.1,z:6*Math.sin(Math.PI/4)}};
    const [bend]=buildBrRoadBends([a,next],()=>0,[]);
    expect(bend.insideFans).toHaveLength(8);
    for(const arm of bend.arms)expect(arm.tangent).toBeLessThanOrEqual(6*.45+1e-8);
    expect(buildBrRoadBends([a,b],p=>Math.abs(p.x-1)<.5&&Math.abs(p.z-1)<.5?5:0,[])).toEqual([]);
  });
  it("excludes full grade and solid footprints, including a solid hidden between polygon vertices",()=>{
    const grade={...a,id:"grade",from:{x:-20,y:2,z:1},to:{x:20,y:3,z:1},width:1};
    expect(buildBrRoadBends([a,b,grade],()=>0,[])).toEqual([]);
    const block={id:"solid",districtId:"test",kind:"platform" as const,color:"#fff",position:{x:1,y:4,z:1},size:{x:.4,y:8,z:.4}};
    expect(buildBrRoadBends([a,b],()=>0,[],[block])).toEqual([]);
  });
  it("keeps real North Civic curves while preserving grade-adjacent and raised-deck boundaries",()=>{
    const bends=buildBrRoadBends(BR_ROADS);
    for(const z of [86,104,170])expect(bends.some(b=>b.center.z===z&&b.edge.length===9)).toBe(true);
    expect(bends.some(b=>b.center.x===-5&&b.center.z===184)).toBe(false);
    expect(bends.some(b=>b.center.x===340&&b.center.z===-275)).toBe(false);
    bends[0].vertices[0].x=9999;
    expect(buildBrRoadBends(BR_ROADS)[0].vertices[0].x).not.toBe(9999);
  });
});

it("bounds oblique tangencies on a six-metre leg and preserves tangent directions",()=>{
  const a:BrRoadSegment={id:"oblique-a",from:{x:-15,y:.1,z:170},to:{x:-5,y:.1,z:184},width:6,color:"#000"};
  const b={...a,id:"oblique-b",from:a.to,to:{x:-5,y:.1,z:190}};
  const before=JSON.stringify([a,b]),[bend]=buildBrRoadBends([a,b],()=>0,[]);
  expect(bend.insideFans).toHaveLength(8);expect(bend.outerEdge).toHaveLength(9);
  for(const arm of bend.arms){
    expect(arm.tangent).toBeLessThanOrEqual(2.7);
    const endpoint=arm.roadId===a.id?bend.edge.at(-1)!:bend.edge[0];
    expect((endpoint.x-bend.center.x)*arm.direction.x+(endpoint.z-bend.center.z)*arm.direction.z).toBeCloseTo(arm.tangent);
    expect(Math.abs((endpoint.x-bend.center.x)*arm.direction.z-(endpoint.z-bend.center.z)*arm.direction.x)).toBeCloseTo(3);
  }
  const first=bend.edge[0],next=bend.edge[1],arm=bend.arms[1];
  expect(Math.abs(((next.x-first.x)*arm.direction.x+(next.z-first.z)*arm.direction.z)/Math.hypot(next.x-first.x,next.z-first.z))).toBeGreaterThan(.99);
  expect(JSON.stringify([a,b])).toBe(before);
});
it("rejects interior support holes, solid footprints and full crossing grade ribbons",()=>{
  expect(buildBrRoadBends([a,b],p=>Math.hypot(p.x,p.z)<1?2:0,[])).toEqual([]);
  const grade={...a,id:"grade",from:{x:-20,y:.2,z:1},to:{x:20,y:1,z:1},width:1};
  expect(buildBrRoadBends([a,b,grade],()=>0,[])).toEqual([]);
  const branch={...a,id:"branch",from:{x:0,y:.1,z:-20},to:{x:0,y:.1,z:20}};
  expect(buildBrRoadBends([a,b,branch],()=>0,[])).toEqual([]);
});
