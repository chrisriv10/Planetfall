import {describe,it,expect} from "vitest";
import {PG_MAP} from "@planetfall/shared";
import {buildPgNeighborhoodStreets} from "./pg-neighborhood-streets";
import type {PgArtContext} from "./pg-environment-builder";

const capture=()=>{const calls:Parameters<PgArtContext["add"]>[]=[];buildPgNeighborhoodStreets({add:(...args)=>calls.push(args)});return calls;};
describe("Nova neighborhood streets and landscape",()=>{
  it("separates cap and rim faces from their solid bodies within a four-centimeter silhouette",()=>{
    const calls=capture();
    const bodies=PG_MAP.solids.filter(s=>s.id==="habitat-garden-terrace"||s.id.startsWith("garden-bed-")||s.id==="transit-ticket-bank");
    for(const body of bodies){
      const trim=calls.filter(([name])=>body.id==="habitat-garden-terrace"?name.startsWith("garden-terrace-cap-"):name.startsWith(`${body.id}-rim-`));
      expect(trim.length).toBe(body.id==="habitat-garden-terrace"?2:4);
      const center=[body.center.x,body.center.y,body.center.z],half=[body.half.x,body.half.y,body.half.z];
      for(const [name,,,p]of trim){
        for(let axis=0;axis<3;axis++)for(const side of[-1,1]){
          const face=p[axis]+side*p[axis+3]/2;
          expect(Math.abs(face-center[axis])-half[axis],name).toBeLessThan(.04);
          for(const bodySide of[-1,1])expect(Math.abs(face-(center[axis]+bodySide*half[axis])),`${name} coplanar axis ${axis}`).toBeGreaterThan(.004);
        }
        expect(p[1]+p[4]/2-body.center.y-body.half.y).toBeCloseTo(.03,6);
      }
      for(let i=0;i<trim.length;i++)for(let j=i+1;j<trim.length;j++){
        const a=trim[i][3],b=trim[j][3];
        const overlap=[0,1,2].map(axis=>Math.min(a[axis]+a[axis+3]/2,b[axis]+b[axis+3]/2)-Math.max(a[axis]-a[axis+3]/2,b[axis]-b[axis+3]/2));
        expect(overlap.some(v=>v<1e-6),"trim corners must not intersect").toBe(true);
      }
      if(body.id!=="habitat-garden-terrace"){
        const soil=calls.find(([name])=>name===`${body.id}-soil`)![3];
        const rim=trim[0][3];expect(rim[1]+rim[4]/2-soil[1]-soil[4]/2).toBeCloseTo(.018,6);
        for(const [,,,r]of trim){
          const ox=Math.min(soil[0]+soil[3]/2,r[0]+r[3]/2)-Math.max(soil[0]-soil[3]/2,r[0]-r[3]/2);
          const oz=Math.min(soil[2]+soil[5]/2,r[2]+r[5]/2)-Math.max(soil[2]-soil[5]/2,r[2]-r[5]/2);
          expect(Math.min(ox,oz)).toBeLessThan(-.011);
        }
      }
    }
  });
  it("keeps all ground route surfaces flush and outside authoritative ground cover",()=>{
    const surfaces=capture().filter(([name])=>/^(street|walk|crossing|spine-guide|habitat-guide|relay-plaza)/.test(name));
    expect(surfaces.length).toBeGreaterThan(50);
    for(const [name,,,p] of surfaces){
      const [x,y,z,sx,sy,sz]=p;expect(y+sy/2,name).toBeLessThan(.03);
      for(const solid of PG_MAP.solids){
        if(solid.id==="orbital-deck"||solid.center.y-solid.half.y>.04||solid.center.y+solid.half.y<=0)continue;
        const overlapX=Math.min(x+sx/2,solid.center.x+solid.half.x)-Math.max(x-sx/2,solid.center.x-solid.half.x);
        const overlapZ=Math.min(z+sz/2,solid.center.z+solid.half.z)-Math.max(z-sz/2,solid.center.z-solid.half.z);
        expect(overlapX<=0||overlapZ<=0,`${name} intersects ${solid.id}`).toBe(true);
      }
    }
  });
  it("gives each real tree a broad high crown that survives Low detail culling",()=>{
    const calls=capture(),trees=PG_MAP.solids.filter(s=>s.id.startsWith("garden-tree-"));
    expect(trees).toHaveLength(4);
    for(const tree of trees){
      const crowns=calls.filter(([name])=>name.startsWith(`${tree.id}-canopy-`));
      expect(crowns).toHaveLength(5);
      for(const [,,,p,,detail]of crowns){expect(detail).not.toBe(true);expect(p[1]-p[4]).toBeGreaterThan(4);}
      expect(Math.max(...crowns.map(c=>c[3][1]+c[3][4]))).toBeGreaterThan(8);
    }
  });
  it("uses bounded shared batches and finite positive authored transforms",()=>{
    const calls=capture();
    expect(new Set(calls.map(([,primitive,material,,,detail])=>`${primitive}:${material}:${!!detail}`)).size).toBeLessThanOrEqual(10);
    for(const [,,,p]of calls){expect(p.every(Number.isFinite)).toBe(true);expect(p.slice(3).every(v=>v>0)).toBe(true);}
  });
});
