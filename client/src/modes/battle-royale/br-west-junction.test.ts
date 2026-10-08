import {describe,expect,it} from "vitest";
import {BR_STRUCTURES,BR_ROADS,BR_LOOT_SOCKETS,BR_CRATE_SOCKETS,brAuthoredDeckHeight} from "@planetfall/shared";
import {buildBrWestJunctionDressing} from "./br-west-junction";
import {buildNovaEntrancePaving} from "./br-entrance-paving";

describe("West Junction ground frontage",()=>{
  it("composes three broad ground forecourts in two shared surface batches without mutation",()=>{
    const before=JSON.stringify([BR_STRUCTURES,BR_ROADS]);
    const kit=buildBrWestJunctionDressing()!;
    expect(kit).toBeDefined();expect(kit.parts).toHaveLength(15);expect(kit.batches).toHaveLength(2);
    expect(kit.id).toBe("west-junction");
    for(const s of BR_STRUCTURES.filter(s=>s.districtId===kit.id))expect(buildNovaEntrancePaving(s)).toEqual([]);
    expect(kit.batches.flatMap(b=>b.parts)).toHaveLength(15);
    for(const p of kit.parts){
      expect(p.surface).toBe(true);expect(p.geometry).toBe("box");expect(p.rotationY).toBe(0);
      expect(p.position.y).toBe(.02);expect(p.scale.y).toBe(.016);
      expect(p.position.y+p.scale.y/2).toBeLessThanOrEqual(.04);
      expect(Object.values(p.scale).every(n=>Number.isFinite(n)&&n>0)).toBe(true);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const point={x:p.position.x+sx*p.scale.x/2,z:p.position.z+sz*p.scale.z/2};
        expect(brAuthoredDeckHeight(point)).toBe(0);
        expect(Math.hypot(point.x-kit.center.x,point.z-kit.center.z)).toBeLessThan(kit.radius);
      }
    }
    expect(buildBrWestJunctionDressing()).toEqual(kit);
    expect(JSON.stringify([BR_STRUCTURES,BR_ROADS])).toBe(before);
  });
  it("centers an uninterrupted 4.8m walk on each exact doorway and ends beside its street",()=>{
    const kit=buildBrWestJunctionDressing()!;
    for(const s of BR_STRUCTURES.filter(s=>s.districtId==="west-junction")){
      const walk=kit.parts.find(p=>p.name===`${s.id}-door-walk`)!;
      const ns=s.entrance!=="east",axis=ns?"x":"z",normal=ns?"z":"x",sign=s.entrance==="south"?-1:1;
      expect(walk.position[axis]).toBe(s.position[axis]);expect(walk.scale[axis]).toBe(4.8);
      const near=walk.position[normal]-sign*walk.scale[normal]/2;
      expect(near).toBeCloseTo(s.position[normal]+sign*(s.size[normal]/2+.375));
      const road=BR_ROADS.find(r=>r.id===(s.id.endsWith("shop")?"west-junction-shop-entry":s.id.endsWith("office")?"west-junction-office-entry":"west-junction-main"))!;
      expect(walk.position[normal]+sign*walk.scale[normal]/2).toBeCloseTo(road.from[normal]-sign*(road.width/2+.15));
    }
  });
  it("keeps all full surface rectangles off roads, walls, loot and crates, without coplanar overlaps",()=>{
    const parts=buildBrWestJunctionDressing()!.parts;
    for(const [index,p] of parts.entries()){
      for(const other of parts.slice(index+1))expect(
        Math.min((p.scale.x+other.scale.x)/2-Math.abs(p.position.x-other.position.x),
          (p.scale.z+other.scale.z)/2-Math.abs(p.position.z-other.position.z))).toBeLessThanOrEqual(1e-8);
      for(const s of BR_STRUCTURES)expect(
        Math.abs(p.position.x-s.position.x)>=(p.scale.x+s.size.x)/2+.325-1e-8
        ||Math.abs(p.position.z-s.position.z)>=(p.scale.z+s.size.z)/2+.325-1e-8,`${p.name}: ${s.id}`).toBe(true);
      for(const loot of [...BR_LOOT_SOCKETS.map(l=>l.position),...BR_CRATE_SOCKETS])expect(
        Math.abs(p.position.x-loot.x)>=p.scale.x/2+1||Math.abs(p.position.z-loot.z)>=p.scale.z/2+1,`${p.name}: loot/crate`).toBe(true);
      for(const r of BR_ROADS){
        const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,length=Math.hypot(dx,dz);if(!length)continue;
        const ux=dx/length,uz=dz/length,cx=(r.from.x+r.to.x)/2,cz=(r.from.z+r.to.z)/2;
        expect([[1,0],[0,1],[ux,uz],[-uz,ux]].some(([ax,az])=>
          Math.abs((p.position.x-cx)*ax+(p.position.z-cz)*az)>=
          Math.abs(ax)*p.scale.x/2+Math.abs(az)*p.scale.z/2+
          Math.abs(ax*ux+az*uz)*length/2+Math.abs(-ax*uz+az*ux)*r.width/2-1e-8),`${p.name}: ${r.id}`).toBe(true);
      }
    }
  });
  it("declines incomplete or raised frontage inputs and returns independent parts",()=>{
    expect(buildBrWestJunctionDressing({structures:[],roads:BR_ROADS})).toBeUndefined();
    expect(buildBrWestJunctionDressing({structures:BR_STRUCTURES,roads:[]})).toBeUndefined();
    expect(buildBrWestJunctionDressing({structures:BR_STRUCTURES.map(s=>s.districtId==="west-junction"?{...s,position:{...s.position,y:5}}:s),roads:BR_ROADS})).toBeUndefined();
    const kit=buildBrWestJunctionDressing()!;kit.parts[0].position.x=0;
    expect(buildBrWestJunctionDressing()!.parts[0].position.x).not.toBe(0);
  });
});
