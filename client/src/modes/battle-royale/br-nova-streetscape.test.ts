import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrAuthoredDistrictProps } from "./br-authored-district-props";
import { buildBrNovaStreetscape } from "./br-nova-streetscape";

const distance = (p: {x:number;z:number}, a: {x:number;z:number}, b: {x:number;z:number}) => {
  const dx=b.x-a.x,dz=b.z-a.z,squared=dx*dx+dz*dz;
  const t=squared?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/squared)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
};
const gap = (p:{x:number;z:number}, x:number,z:number,hx:number,hz:number) => Math.hypot(Math.max(0,Math.abs(p.x-x)-hx),Math.max(0,Math.abs(p.z-z)-hz));

describe("fixed Nova street infill", () => {
  it("fills six authored street gaps with bounded deterministic quality tiers", () => {
    const before=JSON.stringify([BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS]);
    const high=buildBrNovaStreetscape("high"),medium=buildBrNovaStreetscape("medium"),low=buildBrNovaStreetscape("low");
    expect(high.map(p=>[p.center.x,p.center.z])).toEqual([[-214,-123],[-211,-147],[-188,-147],[-145,-147],[-144,-124],[-110,-124]]);
    expect(low).toHaveLength(4);expect(medium).toHaveLength(6);
    expect(high.flatMap(p=>p.parts).length).toBeLessThanOrEqual(82);
    expect(medium.flatMap(p=>p.parts).length).toBeLessThan(high.flatMap(p=>p.parts).length);
    expect(buildBrNovaStreetscape("high")).toEqual(high);
    for(const pocket of low)expect(high.find(p=>p.id===pocket.id)?.center).toEqual(pocket.center);
    expect(buildBrNovaStreetscape("high",()=>false)).toEqual([]);
    expect(JSON.stringify([BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS])).toBe(before);
  });

  it("clears entire circles from roads, facades, six-metre entrance approaches and gameplay volumes",()=>{
    const pockets=buildBrNovaStreetscape("high");
    for(const p of pockets){
      for(const road of BR_ROADS)expect(distance(p.center,road.from,road.to),`${p.id}: ${road.id}`).toBeGreaterThanOrEqual(road.width/2+p.radius+2);
      for(const s of BR_STRUCTURES){
        expect(gap(p.center,s.position.x,s.position.z,s.size.x/2,s.size.z/2),`${p.id}: ${s.id}`).toBeGreaterThanOrEqual(p.radius+2);
        if(!s.enterable)continue;
        const ns=s.entrance==="north"||s.entrance==="south",sign=s.entrance==="north"||s.entrance==="east"?1:-1;
        expect(gap(p.center,s.position.x+(ns?0:sign*(s.size.x/2+3)),s.position.z+(ns?sign*(s.size.z/2+3):0),ns?2.5:3,ns?3:2.5),`${p.id}: ${s.id} door`).toBeGreaterThanOrEqual(p.radius+1);
      }
      for(const b of BR_MAP_BLOCKS){
        if(b.kind!=="cover"&&b.kind!=="ramp"&&b.kind!=="bridge")continue;
        expect(Math.hypot(p.center.x-b.position.x,p.center.z-b.position.z),`${p.id}: ${b.id}`).toBeGreaterThanOrEqual(Math.hypot(b.size.x,b.size.y,b.size.z)/2+p.radius+2);
      }
      for(const t of BR_TRAVERSAL)expect(Math.hypot(p.center.x-t.position.x,p.center.z-t.position.z)).toBeGreaterThanOrEqual(p.radius+9);
      for(const l of BR_LOOT_SOCKETS)expect(Math.hypot(p.center.x-l.position.x,p.center.z-l.position.z)).toBeGreaterThanOrEqual(p.radius+1);
      for(const d of BR_DISTRICT_PLANS)expect(Math.hypot(p.center.x-d.openZone.position.x,p.center.z-d.openZone.position.z)).toBeGreaterThanOrEqual(p.radius+d.openZone.radius+1);
      for(const other of [...buildBrAuthoredDistrictProps({id:"nova-plaza"}),...pockets.filter(other=>other.id!==p.id)])expect(Math.hypot(p.center.x-other.center.x,p.center.z-other.center.z)).toBeGreaterThanOrEqual(p.radius+other.radius+2);
      let inside=false;
      for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
        const [x,z]=BR_ISLAND_OUTLINE[i],[px,pz]=BR_ISLAND_OUTLINE[j];
        expect(distance(p.center,{x,z},{x:px,z:pz})).toBeGreaterThan(p.radius+5);
        if((z>p.center.z)!==(pz>p.center.z)&&p.center.x<(px-x)*(p.center.z-z)/(pz-z)+x)inside=!inside;
      }
      expect(inside).toBe(true);
    }
  });

  it("contains all complete footprints, uses human-scale lamps/seats and excludes false cover",()=>{
    for(const pocket of buildBrNovaStreetscape("high"))for(const part of pocket.parts){
      expect([...Object.values(part.position),...Object.values(part.scale),part.rotationY].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(v=>v>0)).toBe(true);
      const radial=part.geometry==="octahedron",half=radial?1:.5;
      expect(part.position.y-part.scale.y*half).toBeGreaterThanOrEqual(0);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const dx=part.position.x-pocket.center.x+Math.cos(part.rotationY)*sx*part.scale.x*half+Math.sin(part.rotationY)*sz*part.scale.z*half;
        const dz=part.position.z-pocket.center.z-Math.sin(part.rotationY)*sx*part.scale.x*half+Math.cos(part.rotationY)*sz*part.scale.z*half;
        expect(Math.hypot(dx,dz)).toBeLessThan(pocket.radius);
      }
      if(part.finish==="windowLit"){expect(part.position.y).toBeGreaterThan(3);expect(part.scale.x*part.scale.z).toBeLessThan(.1);}
      if(part.position.y<2.6&&part.position.y+part.scale.y*half>.8){expect(part.scale.x).toBeLessThanOrEqual(.42);expect(part.scale.z).toBeLessThanOrEqual(.1);}
      if(part.scale.x===1.75)expect(part.position.y+part.scale.y/2).toBeCloseTo(.525);
    }
  });
});
