import { describe, expect, it } from "vitest";
import { BR_ROADS } from "@planetfall/shared";
import * as THREE from "three";
import type { BrRoadSegment, BrStructure } from "@planetfall/shared";
import { brRoadPolygonArea, buildBrRoadSurfaces, buildBrVisibleRoadSpans } from "./br-road-surfaces";

const contains=(polygon:readonly {x:number;z:number}[],x:number,z:number)=>polygon.every((p,i)=>{const q=polygon[(i+1)%polygon.length];return(q.x-p.x)*(z-p.z)-(q.z-p.z)*(x-p.x)>1e-7;});
describe("continuous road junction pavement",()=>{
  it("covers the full authored network through bends and grade endpoints at the correct height",()=>{
    const surfaces=buildBrRoadSurfaces(BR_ROADS).map(surface=>({
      ...surface,plane:new THREE.Plane().setFromCoplanarPoints(...surface.vertices.slice(0,3).map(p=>new THREE.Vector3(p.x,p.y,p.z)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3])
    }));
    const covered=(point:THREE.Vector3)=>surfaces.some(s=>Math.abs(s.plane.distanceToPoint(point))<.001
      &&s.vertices.every((a,i)=>{const b=s.vertices[(i+1)%s.vertices.length];return(b.x-a.x)*(point.z-a.z)-(b.z-a.z)*(point.x-a.x)>=-1e-6;}));
    for(const road of BR_ROADS){
      const dx=road.to.x-road.from.x,dz=road.to.z-road.from.z,length=Math.hypot(dx,dz),steps=Math.max(2,Math.ceil(length/2));
      for(let i=0;i<=steps;i++)for(const side of [-.45,0,.45]){
        const t=i/steps,point=new THREE.Vector3(road.from.x+dx*t-dz/length*road.width*side,
          road.from.y+(road.to.y-road.from.y)*t-.065,road.from.z+dz*t+dx/length*road.width*side);
        expect(covered(point),`${road.id} at ${t}, lateral ${side}`).toBe(true);
      }
    }
  });
  it("covers an oblique junction without whole-width wedge gaps or stacked polygons",()=>{
    const diagonal:BrRoadSegment={...road,id:"diagonal",from:{x:-16,y:0,z:-16},to:{x:16,y:0,z:16}};
    const surfaces=buildBrRoadSurfaces([road,diagonal]);
    expect(surfaces.some(surface=>surface.junction)).toBe(true);
    for(let x=-15.9;x<16;x+=.37)for(let z=-15.83;z<16;z+=.41){
      const inHorizontal=Math.abs(z)<4&&Math.abs(x)<20;
      const along=(x+z)/Math.SQRT2,across=(z-x)/Math.SQRT2;
      const inDiagonal=Math.abs(along)<16*Math.SQRT2&&Math.abs(across)<4;
      const coverage=surfaces.filter(surface=>contains(surface.vertices,x,z)).length;
      expect(coverage,`${x},${z} overlaps`).toBeLessThanOrEqual(1);
      if(inHorizontal||inDiagonal)expect(coverage,`${x},${z} pavement gap`).toBe(1);
    }
  });
  it("deduplicates collinear roads without shortening the connected street",()=>{
    const duplicate={...road,id:"duplicate"};
    const surfaces=buildBrRoadSurfaces([road,duplicate]);
    expect(surfaces.reduce((sum,surface)=>sum+brRoadPolygonArea(surface.vertices),0)).toBeCloseTo(320);
  });
  it("keeps grade planes and genuine bridges separate",()=>{
    const upper={...road,id:"bridge",from:{x:0,y:5,z:-20},to:{x:0,y:7,z:20}};
    const surfaces=buildBrRoadSurfaces([road,upper]);
    expect(surfaces.some(surface=>surface.junction)).toBe(false);
    expect(surfaces.filter(surface=>contains(surface.vertices,.2,.3))).toHaveLength(2);
    expect(surfaces.find(surface=>surface.sourceRoadId==="bridge")!.vertices.map(v=>v.y)).toEqual([4.935,6.935,6.935,4.935]);
  });
  it.each([4,-3])("does not erase a %sm grade that shares a flat road's entry height",height=>{
    const grade={...road,id:"entry-grade",to:{...road.to,y:height}};
    const surfaces=buildBrRoadSurfaces([road,grade]);
    for(const id of ["road","entry-grade"]){
      expect(surfaces.filter(s=>s.sourceRoadId===id).reduce((sum,s)=>sum+brRoadPolygonArea(s.vertices),0)).toBeCloseTo(320);
    }
    expect(surfaces.some(s=>s.junction)).toBe(false);
    expect(surfaces.find(s=>s.sourceRoadId==="entry-grade")!.vertices.map(p=>p.y))
      .toEqual([-.065,height-.065,height-.065,-.065]);
  });
});

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
