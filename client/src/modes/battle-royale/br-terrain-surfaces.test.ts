import { describe,expect,it } from "vitest";
import { BR_ELEVATION_REGIONS,BR_SECONDARY_GRADE_REGIONS,BR_TERRAIN_PATCHES, type BrTerrainPatch } from "@planetfall/shared";
import { buildBrTerrainSurface,BR_TERRAIN_SURFACE_LIFT,type BrTerrainSupportRegion } from "./br-terrain-surfaces";

const regions=[...BR_ELEVATION_REGIONS,...BR_SECONDARY_GRADE_REGIONS];
const triangleArea=(a:{x:number;z:number},b:{x:number;z:number},c:{x:number;z:number})=>Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;
const support=(x:number,z:number,list:readonly BrTerrainSupportRegion[])=>list.filter(r=>Math.abs(x-r.x)<r.width/2&&Math.abs(z-r.z)<r.depth/2).sort((a,b)=>b.height-a.height||a.id.localeCompare(b.id))[0]?.height??0;
function check(patch:BrTerrainPatch,list:readonly BrTerrainSupportRegion[]){
  const fragments=buildBrTerrainSurface(patch,list);
  let area=0;
  for(const f of fragments){
    for(const v of f.vertices)expect(v.y).toBe(f.deckHeight+BR_TERRAIN_SURFACE_LIFT);
    for(const uv of f.uvs){expect(uv.u).toBeGreaterThanOrEqual(-1e-9);expect(uv.u).toBeLessThanOrEqual(1+1e-9);expect(uv.v).toBeGreaterThanOrEqual(-1e-9);expect(uv.v).toBeLessThanOrEqual(1+1e-9);}
    for(let i=0;i<f.indices.length;i+=3){
      const [a,b,c]=f.indices.slice(i,i+3).map(index=>f.vertices[index]);
      area+=triangleArea(a,b,c);
      expect((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)).toBeGreaterThanOrEqual(-1e-9);
      // Interior barycentric grid detects triangles crossing a support boundary.
      for(const u of [.01,.2,.5,.8,.98])for(const v of [.01,.2,.5,.8,.98])if(u+v<1){
        const x=a.x+(b.x-a.x)*u+(c.x-a.x)*v,z=a.z+(b.z-a.z)*u+(c.z-a.z)*v;
        expect(f.deckHeight,`${patch.id}: ${x},${z}`).toBe(support(x,z,list));
      }
    }
  }
  expect(area).toBeCloseTo(patch.size.x*patch.size.z,7);
  return fragments;
}

describe("terrain finishes follow real deck fragments",()=>{
  it.each([["astra-quad",8],["helios-deck",6],["coolant-east",-3]] as const)("splits %s across both supporting floors without losing area",(id,height)=>{
    const patch=BR_TERRAIN_PATCHES.find(p=>p.id===id)!;
    const fragments=check(patch,regions);
    expect(new Set(fragments.map(f=>f.deckHeight))).toEqual(new Set([0,height]));
    expect(fragments.length).toBeLessThanOrEqual(6);
  });
  it("partitions overlapping rotated fixtures without holes or duplicate coverage and retains original UVs",()=>{
    const patch:BrTerrainPatch={...BR_TERRAIN_PATCHES[0],position:{x:0,y:99,z:0},size:{x:20,y:4,z:16},rotation:.37};
    const decks=[{id:"basin",x:2,z:0,width:12,depth:12,height:-3},{id:"upper",x:-3,z:2,width:8,depth:9,height:4}];
    const f=check(patch,decks);
    // An independent dense footprint grid must be covered exactly once (except
    // exact polygon edges), across both disjoint and overlapping region input.
    const contains=(x:number,z:number,vertices:{x:number;z:number}[])=>vertices.every((a,i)=>{
      const b=vertices[(i+1)%vertices.length];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x)>1e-9;
    });
    for(let x=-13.123;x<13;x+=.47)for(let z=-13.213;z<13;z+=.43){
      const lx=x*Math.cos(patch.rotation)-z*Math.sin(patch.rotation),lz=x*Math.sin(patch.rotation)+z*Math.cos(patch.rotation);
      const expected=Math.abs(lx)<10&&Math.abs(lz)<8?1:0;
      expect(f.filter(fragment=>contains(x,z,fragment.vertices)).length,`${x},${z}`).toBe(expected);
    }
    expect(buildBrTerrainSurface(patch,decks.slice().reverse())).toEqual(f);
  });
  it("is immutable, finite, below pavement/feet, and bounded over all authored patches",()=>{
    const before=JSON.stringify([BR_TERRAIN_PATCHES,regions]);
    let triangles=0;
    for(const patch of BR_TERRAIN_PATCHES){
      const fragments=check(patch,regions);
      expect(fragments.length).toBeLessThanOrEqual(12);
      for(const f of fragments){triangles+=f.indices.length/3;expect(f.vertices.every(v=>Object.values(v).every(Number.isFinite))).toBe(true);}
      expect(buildBrTerrainSurface(patch)).toEqual(fragments);
    }
    expect(triangles).toBeLessThan(160);
    expect(BR_TERRAIN_SURFACE_LIFT).toBeGreaterThan(0);
    expect(BR_TERRAIN_SURFACE_LIFT).toBeLessThan(.035);
    expect(JSON.stringify([BR_TERRAIN_PATCHES,regions])).toBe(before);
  });
  it("rejects invalid patches and ignores invalid or degenerate support regions safely",()=>{
    const patch=BR_TERRAIN_PATCHES[0];
    expect(buildBrTerrainSurface({...patch,rotation:NaN})).toEqual([]);
    expect(buildBrTerrainSurface({...patch,size:{...patch.size,x:0}})).toEqual([]);
    expect(buildBrTerrainSurface({...patch,position:{...patch.position,z:Infinity}})).toEqual([]);
    expect(buildBrTerrainSurface(patch,[{id:"bad",x:0,z:0,width:0,depth:2,height:5},{id:"nan",x:0,z:0,width:4,depth:4,height:NaN}])).toEqual(buildBrTerrainSurface(patch,[]));
  });
});
