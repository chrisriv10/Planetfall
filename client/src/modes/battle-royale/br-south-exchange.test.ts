import { describe,expect,it } from "vitest";
import { BR_ROAD_ROUTES,BR_STRUCTURES,BR_LOOT_SOCKETS,BR_MAP_BLOCKS } from "@planetfall/shared";
import { buildBrSouthExchangeDressing } from "./br-south-exchange";
import { blockClearance } from "./br-presentation-clearance-test-utils";

const input={structures:BR_STRUCTURES,roads:BR_ROAD_ROUTES};
const buildings=BR_STRUCTURES.filter(s=>s.districtId==="south-exchange");
const half=(p:NonNullable<ReturnType<typeof buildBrSouthExchangeDressing>>["parts"][number])=>({x:p.scale.x*(p.geometry==="box"?.5:1),y:p.scale.y*(p.geometry==="octahedron"?1:.5),z:p.scale.z*(p.geometry==="box"?.5:1)});
const gap=(p:{x:number;z:number},x:number,z:number,hx:number,hz:number)=>Math.hypot(Math.max(0,Math.abs(p.x-x)-hx),Math.max(0,Math.abs(p.z-z)-hz));

describe("South Exchange authored frontage dressing",()=>{
  it("batches a bounded deterministic composition without mutating map inputs",()=>{
    const before=JSON.stringify(input),dressing=buildBrSouthExchangeDressing()!;
    expect(buildings).toHaveLength(4);
    expect(dressing.parts).toHaveLength(56);
    expect(dressing.signs).toHaveLength(4);
    expect(dressing.batches.length).toBeLessThanOrEqual(8);
    expect(new Set(dressing.batches.flatMap(b=>b.parts)).size).toBe(dressing.parts.length);
    expect(buildBrSouthExchangeDressing({structures:[...BR_STRUCTURES].reverse(),roads:[...BR_ROAD_ROUTES].reverse()})).toEqual(dressing);
    expect(JSON.stringify(input)).toBe(before);
    expect(buildBrSouthExchangeDressing({...input,structures:[]})).toBeUndefined();
    dressing.parts[0].position.y=99;
    expect(buildBrSouthExchangeDressing()!.parts[0].position.y).toBe(.02);
  });
  it("connects every real door to the sidewalk and keeps full six-metre approaches clear of furniture",()=>{
    const d=buildBrSouthExchangeDressing()!;
    for(const s of buildings){
      const direction=s.entrance==="east"?1:-1,facade=s.position.x+direction*s.size.x/2;
      const path=d.parts.find(p=>p.name===`${s.id}-entry-path`)!;
      expect(path.position.z).toBe(s.position.z);
      expect(path.scale.z).toBe(3.2);
      expect(path.position.x-direction*path.scale.x/2).toBeCloseTo(facade);
      for(const p of d.parts.filter(p=>!p.surface)){
        const h=half(p);
        expect(gap(p.position,facade+direction*3,s.position.z,3+h.x,2.5+h.z),`${p.name}: ${s.id}`).toBeGreaterThan(.5);
      }
      const sign=d.signs.find(sign=>sign.position.x===facade+direction*.36&&sign.position.z===s.position.z)!;
      expect(sign.position.y-sign.height/2).toBeGreaterThan(s.position.y+3.1);
    }
  });
  it("keeps complete footprints outside roads, buildings, gameplay blocks and loot sockets",()=>{
    for(const p of buildBrSouthExchangeDressing()!.parts){
      const h=half(p);
      for(const road of BR_ROAD_ROUTES){
        const minX=Math.min(road.from.x,road.to.x)-road.width/2-h.x,maxX=Math.max(road.from.x,road.to.x)+road.width/2+h.x;
        const minZ=Math.min(road.from.z,road.to.z)-road.width/2-h.z,maxZ=Math.max(road.from.z,road.to.z)+road.width/2+h.z;
        if(p.position.x<minX||p.position.x>maxX||p.position.z<minZ||p.position.z>maxZ)continue;
        const count=Math.ceil(Math.hypot(road.to.x-road.from.x,road.to.z-road.from.z)*4);
        for(let i=0;i<=count;i++)expect(gap(p.position,road.from.x+(road.to.x-road.from.x)*i/count,road.from.z+(road.to.z-road.from.z)*i/count,h.x,h.z),`${p.name}: ${road.id}`).toBeGreaterThanOrEqual(road.width/2+.1);
      }
      for(const loot of BR_LOOT_SOCKETS)expect(gap(loot.position,p.position.x,p.position.z,h.x,h.z),`${p.name}: ${loot.id}`).toBeGreaterThan(1);
      if(!p.surface){
        for(const s of BR_STRUCTURES)expect(gap(p.position,s.position.x,s.position.z,s.size.x/2+h.x,s.size.z/2+h.z),`${p.name}: ${s.id}`).toBeGreaterThan(.5);
        for(const b of BR_MAP_BLOCKS)expect(blockClearance(p.position,p.position.y-h.y,p.position.y+h.y,b),`${p.name}: ${b.id}`).toBeGreaterThan(Math.hypot(h.x,h.z)+.25);
      }
    }
  });
  it("uses structure heights, thin floor finishes and slender trees instead of noncolliding cover",()=>{
    const d=buildBrSouthExchangeDressing()!,raised=buildBrSouthExchangeDressing({...input,structures:BR_STRUCTURES.map(s=>({...s,position:{...s.position,y:s.position.y+2}}))})!;
    d.parts.forEach((p,i)=>{
      const h=half(p),s=buildings.find(s=>p.name.startsWith(`${s.id}-`))!;
      expect(raised.parts[i].position.y).toBeCloseTo(p.position.y+2);
      expect([...Object.values(p.position),...Object.values(p.scale)].every(Number.isFinite)).toBe(true);
      expect(Object.values(p.scale).every(v=>v>0)).toBe(true);
      expect(p.position.y-h.y).toBeGreaterThanOrEqual(s.position.y);
      if(p.surface)expect(p.position.y+h.y-s.position.y).toBeLessThanOrEqual(.041);
      else if(p.finish==="canopy")expect(p.position.y-h.y-s.position.y).toBeGreaterThan(3.7);
      else if(p.position.y+h.y>s.position.y+.55){expect(h.x*2).toBeLessThan(.22);expect(h.z*2).toBeLessThan(.22);}
      for(const x of [-h.x,h.x])for(const z of [-h.z,h.z])expect(Math.hypot(p.position.x+x-d.center.x,p.position.z+z-d.center.z)).toBeLessThan(d.radius);
    });
  });
});
