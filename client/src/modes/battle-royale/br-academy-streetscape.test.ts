import { describe,expect,it } from "vitest";
import { BR_DISTRICT_PLANS,BR_ISLAND_OUTLINE,BR_LOOT_SOCKETS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES,BR_TERRACES,BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrAcademyStreetscape } from "./br-academy-streetscape";

const distance=(p:{x:number;z:number},a:{x:number;z:number},b:{x:number;z:number})=>{
  const dx=b.x-a.x,dz=b.z-a.z,sq=dx*dx+dz*dz,t=sq?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/sq)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
};
const gap=(p:{x:number;z:number},x:number,z:number,hx:number,hz:number)=>Math.hypot(Math.max(0,Math.abs(p.x-x)-hx),Math.max(0,Math.abs(p.z-z)-hz));
const deck=BR_TERRACES.find(t=>t.id==="academy-commons-deck")!;

describe("authored Academy approach pockets",()=>{
  it("keeps exact placements, unmutated inputs and stable LOD silhouettes with bounded parts",()=>{
    const before=JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES]);
    const high=buildBrAcademyStreetscape("high"),medium=buildBrAcademyStreetscape("medium"),low=buildBrAcademyStreetscape("low");
    expect(high.map(p=>[p.center.x,p.center.z])).toEqual([[-273,263],[-272,244],[-273,206]]);
    expect(high.flatMap(p=>p.parts)).toHaveLength(41);
    expect(medium.flatMap(p=>p.parts)).toHaveLength(36);
    expect(low.flatMap(p=>p.parts)).toHaveLength(24);
    expect(buildBrAcademyStreetscape("high")).toEqual(high);
    for(const pocket of low)for(const part of pocket.parts)expect(high.find(p=>p.id===pocket.id)?.parts).toContainEqual(part);
    expect(JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES])).toBe(before);
  });

  it("protects entire reserved circles around roads, doors, buildings, loot and combat space",()=>{
    for(const pocket of buildBrAcademyStreetscape("high")){
      const p=pocket.center,r=pocket.radius;
      for(const road of BR_ROADS)expect(distance(p,road.from,road.to),`${pocket.id}: ${road.id}`).toBeGreaterThanOrEqual(r+road.width/2+1);
      for(const s of BR_STRUCTURES){
        expect(gap(p,s.position.x,s.position.z,s.size.x/2,s.size.z/2),`${pocket.id}: ${s.id}`).toBeGreaterThanOrEqual(r+.75);
        const ns=s.entrance==="north"||s.entrance==="south",sign=s.entrance==="north"||s.entrance==="east"?1:-1;
        expect(gap(p,s.position.x+(ns?0:sign*(s.size.x/2+3)),s.position.z+(ns?sign*(s.size.z/2+3):0),ns?2.5:3,ns?3:2.5),`${pocket.id}: ${s.id} approach`).toBeGreaterThanOrEqual(r+.5);
      }
      for(const b of BR_MAP_BLOCKS.filter(b=>["cover","ramp","bridge"].includes(b.kind)))expect(Math.hypot(p.x-b.position.x,p.z-b.position.z),b.id).toBeGreaterThan(r+Math.hypot(b.size.x,b.size.y,b.size.z)/2+1);
      for(const l of BR_LOOT_SOCKETS)expect(Math.hypot(p.x-l.position.x,p.z-l.position.z)).toBeGreaterThan(r+1);
      for(const t of BR_TRAVERSAL)expect(Math.hypot(p.x-t.position.x,p.z-t.position.z)).toBeGreaterThan(r+8);
      for(const d of BR_DISTRICT_PLANS)expect(Math.hypot(p.x-d.openZone.position.x,p.z-d.openZone.position.z)).toBeGreaterThan(r+d.openZone.radius);
      // Existing authored specimen garden remains a separate pocket.
      expect(Math.hypot(p.x+285,p.z-265)).toBeGreaterThan(r+4);
      expect(Math.abs(p.x-deck.position.x)+r).toBeLessThan(deck.size.x/2);
      expect(Math.abs(p.z-deck.position.z)+r).toBeLessThan(deck.size.z/2);
      let inside=false;
      for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
        const [x,z]=BR_ISLAND_OUTLINE[i],[px,pz]=BR_ISLAND_OUTLINE[j];
        expect(distance(p,{x,z},{x:px,z:pz})).toBeGreaterThan(r+5);
        if((z>p.z)!==(pz>p.z)&&p.x<(px-x)*(p.z-z)/(pz-z)+x)inside=!inside;
      }
      expect(inside).toBe(true);
    }
  });

  it("contains complete finite parts with clear, high crowns and no opaque cover masses",()=>{
    for(const pocket of buildBrAcademyStreetscape("high"))for(const part of pocket.parts){
      expect([...Object.values(part.position),...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(v=>v>0)).toBe(true);
      const radial=part.geometry!=="box",h=radial?1:.5,hy=part.geometry==="octahedron"?1:.5;
      expect(part.position.y-part.scale.y*hy).toBeGreaterThanOrEqual(deck.height);
      for(const sx of [-1,1])for(const sz of [-1,1])expect(Math.hypot(part.position.x-pocket.center.x+sx*part.scale.x*h,part.position.z-pocket.center.z+sz*part.scale.z*h)).toBeLessThan(pocket.radius);
      if(part.finish==="canopy"&&part.position.y>deck.height+2)expect(part.position.y-part.scale.y).toBeGreaterThan(deck.height+2.6);
      if(part.finish!=="canopy"&&part.position.y>deck.height+.6&&part.position.y<deck.height+3){expect(part.scale.x).toBeLessThanOrEqual(.26);expect(part.scale.z).toBeLessThanOrEqual(.1);}
      if(part.scale.y===.08)expect(part.position.y+part.scale.y/2-deck.height).toBeCloseTo(.52);
    }
  });
});
