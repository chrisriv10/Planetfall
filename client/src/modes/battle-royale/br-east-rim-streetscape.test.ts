import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_ISLAND_OUTLINE, BR_LOOT_SOCKETS, BR_MAP_BLOCKS, BR_ROADS, BR_STRUCTURES, BR_TERRACES, BR_TRAVERSAL } from "@planetfall/shared";
import { buildBrEastRimStreetscape } from "./br-east-rim-streetscape";
import { blockClearance } from "./br-presentation-clearance-test-utils";

const deck=BR_TERRACES.find(t=>t.id==="east-rim-deck")!;
const parts=()=>buildBrEastRimStreetscape("high").flatMap(group=>group.parts);
const distance=(x:number,z:number,a:{x:number;z:number},b:{x:number;z:number})=>{
  const dx=b.x-a.x,dz=b.z-a.z,sq=dx*dx+dz*dz,t=sq?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/sq)):0;
  return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
};

describe("authored East Rim street composition",()=>{
  it("keeps fixed groups across LOD tiers without mutation, random placement or new resource types",()=>{
    const before=JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES]);
    const high=buildBrEastRimStreetscape("high"),medium=buildBrEastRimStreetscape("medium"),low=buildBrEastRimStreetscape("low");
    expect(high.map(g=>[g.center.x,g.center.z])).toEqual([[392,96],[416,97.5],[426,111.2],[443,105]]);
    expect(high.flatMap(g=>g.parts)).toHaveLength(33);
    expect(medium.flatMap(g=>g.parts)).toHaveLength(29);
    expect(low.flatMap(g=>g.parts)).toHaveLength(18);
    expect(buildBrEastRimStreetscape("high")).toEqual(high);
    for(const group of low)for(const part of group.parts)expect(high.find(g=>g.id===group.id)?.parts).toContainEqual(part);
    expect(JSON.stringify([BR_TERRACES,BR_ROADS,BR_STRUCTURES])).toBe(before);
  });

  it("keeps complete footprints on the raised deck and inside the island, clear of roads and gameplay volumes",()=>{
    for(const part of parts()){
      const half=part.geometry==="octahedron"?1:.5;
      const hx=part.scale.x*half,hz=part.scale.z*half,hy=part.scale.y*half;
      const bottom=part.position.y-hy,top=part.position.y+hy;
      expect([...Object.values(part.position),...Object.values(part.scale)].every(Number.isFinite)).toBe(true);
      expect(Object.values(part.scale).every(value=>value>0)).toBe(true);
      expect(bottom).toBeGreaterThanOrEqual(deck.height);
      expect(Math.abs(part.position.x-deck.position.x)+hx).toBeLessThan(deck.size.x/2-2);
      expect(Math.abs(part.position.z-deck.position.z)+hz).toBeLessThan(deck.size.z/2-2);
      // Sample full footprint, not merely four corners (the long terminus
      // crosshead must not bridge any road or hide a footprint intersection).
      for(let ix=0;ix<=Math.ceil(hx*2/.2);ix++)for(let iz=0;iz<=Math.ceil(hz*2/.2);iz++){
        const x=part.position.x-hx+Math.min(hx*2,ix*.2),z=part.position.z-hz+Math.min(hz*2,iz*.2);
        for(const road of BR_ROADS)expect(distance(x,z,road.from,road.to),`${part.position.x},${part.position.z}: ${road.id}`).toBeGreaterThanOrEqual(road.width/2+1);
        let inside=false;
        for(let i=0,j=BR_ISLAND_OUTLINE.length-1;i<BR_ISLAND_OUTLINE.length;j=i++){
          const [ax,az]=BR_ISLAND_OUTLINE[i],[bx,bz]=BR_ISLAND_OUTLINE[j];
          if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
        }
        expect(inside).toBe(true);
      }
      for(const structure of BR_STRUCTURES){
        if(top<=structure.position.y||bottom>=structure.position.y+structure.size.y)continue;
        const gap=Math.hypot(Math.max(0,Math.abs(part.position.x-structure.position.x)-hx-structure.size.x/2),Math.max(0,Math.abs(part.position.z-structure.position.z)-hz-structure.size.z/2));
        expect(gap,structure.id).toBeGreaterThanOrEqual(1);
        const ns=structure.entrance==="north"||structure.entrance==="south",sign=structure.entrance==="north"||structure.entrance==="east"?1:-1;
        const x=structure.position.x+(ns?0:sign*(structure.size.x/2+3)),z=structure.position.z+(ns?sign*(structure.size.z/2+3):0);
        expect(Math.hypot(Math.max(0,Math.abs(part.position.x-x)-hx-(ns?2.5:3)),Math.max(0,Math.abs(part.position.z-z)-hz-(ns?3:2.5)))).toBeGreaterThanOrEqual(1);
      }
      for(const block of BR_MAP_BLOCKS){
        expect(blockClearance(part.position,bottom,top,block),block.id).toBeGreaterThan(Math.hypot(hx,hz)+1);
      }
      for(const loot of BR_LOOT_SOCKETS)expect(Math.hypot(part.position.x-loot.position.x,part.position.z-loot.position.z)).toBeGreaterThan(Math.hypot(hx,hz)+1);
      for(const t of BR_TRAVERSAL)expect(Math.hypot(part.position.x-t.position.x,part.position.z-t.position.z)).toBeGreaterThan(Math.hypot(hx,hz)+8);
      for(const plan of BR_DISTRICT_PLANS)expect(Math.hypot(part.position.x-plan.openZone.position.x,part.position.z-plan.openZone.position.z)).toBeGreaterThan(Math.hypot(hx,hz)+plan.openZone.radius);
    }
  });

  it("frames the empty horizon with supported open architecture, not false walls or cover",()=>{
    const groups=buildBrEastRimStreetscape("high"),frame=groups.at(-1)!;
    const posts=frame.parts.filter(p=>p.scale.y===6);
    expect(posts).toHaveLength(2);
    const beam=frame.parts.find(p=>p.scale.z===14.24)!;
    for(const post of posts){
      expect(post.position.y-post.scale.y/2).toBe(deck.height);
      expect(post.position.y+post.scale.y/2).toBeGreaterThan(beam.position.y-beam.scale.y/2);
      expect(Math.abs(post.position.z-beam.position.z)).toBeLessThan(beam.scale.z/2);
    }
    for(const p of parts()){
      const top=p.position.y+p.scale.y/2,bottom=p.position.y-p.scale.y/2;
      if(bottom<deck.height+2.7&&top>deck.height+.8){expect(p.scale.x).toBeLessThanOrEqual(.18);expect(p.scale.z).toBeLessThanOrEqual(.22);}
      if(p.finish==="windowLit")expect(p.scale.x*p.scale.y*p.scale.z).toBeLessThan(.003);
    }
    expect(beam.position.y-beam.scale.y/2).toBeGreaterThan(deck.height+5.5);
    expect(frame.center.x).toBeGreaterThan(435+6);
  });
});
