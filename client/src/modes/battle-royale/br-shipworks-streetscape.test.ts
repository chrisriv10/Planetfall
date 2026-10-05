import { describe,expect,it } from "vitest";
import { BR_DISTRICT_PLANS,BR_ISLAND_OUTLINE,BR_LOOT_SOCKETS,BR_MAP_BLOCKS,BR_ROADS,BR_STRUCTURES,BR_TERRACES,BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrShipworksStreetscape } from "./br-shipworks-streetscape";

const segmentDistance=(p:{x:number;z:number},a:{x:number;z:number},b:{x:number;z:number})=>{
  const dx=b.x-a.x,dz=b.z-a.z,sq=dx*dx+dz*dz,t=sq?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/sq)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
};
const gap=(p:{x:number;z:number},x:number,z:number,hx:number,hz:number)=>Math.hypot(Math.max(0,Math.abs(p.x-x)-hx),Math.max(0,Math.abs(p.z-z)-hz));
const deck=BR_TERRACES.find(t=>t.id==="south-shipworks-deck")!;

describe("fixed South Shipworks maintenance streetscape",()=>{
  it("retains authored sites and core silhouettes across bounded quality tiers without mutation",()=>{
    const before=JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES]);
    const high=buildBrShipworksStreetscape("high"),medium=buildBrShipworksStreetscape("medium"),low=buildBrShipworksStreetscape("low");
    expect(high.map(p=>[p.center.x,p.center.z])).toEqual([[199,-371],[181,-387],[182,-408]]);
    expect(high.flatMap(p=>p.parts)).toHaveLength(41);
    expect(medium.flatMap(p=>p.parts)).toHaveLength(35);
    expect(low.flatMap(p=>p.parts)).toHaveLength(26);
    expect(buildBrShipworksStreetscape("high")).toEqual(high);
    for(const pocket of low)for(const part of pocket.parts)expect(high.find(p=>p.id===pocket.id)?.parts).toContainEqual(part);
    expect(JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES])).toBe(before);
  });

  it("reserves complete pockets clear of routes, six-metre doors, gameplay volumes and existing art",()=>{
    const pockets=buildBrShipworksStreetscape("high");
    for(const pocket of pockets){
      const p=pocket.center,r=pocket.radius;
      for(const road of BR_ROADS)expect(segmentDistance(p,road.from,road.to),`${pocket.id}: ${road.id}`).toBeGreaterThanOrEqual(r+road.width/2+1);
      for(const s of BR_STRUCTURES){
        expect(gap(p,s.position.x,s.position.z,s.size.x/2,s.size.z/2),`${pocket.id}: ${s.id}`).toBeGreaterThanOrEqual(r+.75);
        const ns=s.entrance==="north"||s.entrance==="south",sign=s.entrance==="north"||s.entrance==="east"?1:-1;
        expect(gap(p,s.position.x+(ns?0:sign*(s.size.x/2+3)),s.position.z+(ns?sign*(s.size.z/2+3):0),ns?2.5:3,ns?3:2.5),`${pocket.id}: ${s.id} door`).toBeGreaterThanOrEqual(r+.5);
      }
      for(const b of BR_MAP_BLOCKS.filter(b=>["cover","ramp","bridge"].includes(b.kind)))expect(Math.hypot(p.x-b.position.x,p.z-b.position.z),b.id).toBeGreaterThan(r+Math.hypot(b.size.x,b.size.y,b.size.z)/2+1);
      for(const l of BR_LOOT_SOCKETS)expect(Math.hypot(p.x-l.position.x,p.z-l.position.z)).toBeGreaterThan(r+1);
      for(const t of BR_TRAVERSAL)expect(Math.hypot(p.x-t.position.x,p.z-t.position.z)).toBeGreaterThan(r+8);
      for(const d of BR_DISTRICT_PLANS)expect(Math.hypot(p.x-d.openZone.position.x,p.z-d.openZone.position.z)).toBeGreaterThan(r+d.openZone.radius);
      expect(Math.hypot(p.x-160,p.z+390)).toBeGreaterThan(r+4); // Existing authored inspection cradle.
      for(const other of pockets.filter(other=>other.id!==pocket.id))expect(Math.hypot(p.x-other.center.x,p.z-other.center.z)).toBeGreaterThan(r+other.radius+2);
      expect(Math.abs(p.x-deck.position.x)+r).toBeLessThan(deck.size.x/2);
      expect(Math.abs(p.z-deck.position.z)+r).toBeLessThan(deck.size.z/2);
      let inside=false;
      for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
        const [x,z]=BR_ISLAND_OUTLINE[i],[px,pz]=BR_ISLAND_OUTLINE[j];
        expect(segmentDistance(p,{x,z},{x:px,z:pz})).toBeGreaterThan(r+5);
        if((z>p.z)!==(pz>p.z)&&p.x<(px-x)*(p.z-z)/(pz-z)+x)inside=!inside;
      }
      expect(inside).toBe(true);
    }
  });

  it("uses positive finite cached-box transforms and slender supported verticals, not false cover",()=>{
    for(const pocket of buildBrShipworksStreetscape("high"))for(const part of pocket.parts){
      expect([...Object.values(part.position),...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(v=>v>0)).toBe(true);
      expect(part.geometry).toBe("box");expect(part.rotationY).toBe(0);expect(part.surface).toBe(false);
      expect(part.position.y-part.scale.y/2).toBeGreaterThanOrEqual(deck.height-1e-9);
      for(const sx of [-1,1])for(const sz of [-1,1])expect(Math.hypot(part.position.x-pocket.center.x+sx*part.scale.x/2,part.position.z-pocket.center.z+sz*part.scale.z/2)).toBeLessThan(pocket.radius);
      if(part.position.y-part.scale.y/2<deck.height+2.7&&part.position.y+part.scale.y/2>deck.height+.8){expect(part.scale.x).toBeLessThanOrEqual(.13);expect(part.scale.z).toBeLessThanOrEqual(.13);}
      if(part.finish==="windowLit")expect(part.scale.x*part.scale.y*part.scale.z).toBeLessThan(.003);
      if(part.scale.y===.08)expect(part.position.y+part.scale.y/2-deck.height).toBeCloseTo(.52);
    }
    const inspection=buildBrShipworksStreetscape("low")[1],posts=inspection.parts.filter(p=>p.scale.y===3.8),beam=inspection.parts.find(p=>p.scale.x===1.8)!;
    expect(posts).toHaveLength(2);
    for(const post of posts){expect(post.position.y-post.scale.y/2).toBe(deck.height);expect(post.position.y+post.scale.y/2).toBeGreaterThan(beam.position.y-beam.scale.y/2);}
  });
});
