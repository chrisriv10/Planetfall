import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_LOOT_SOCKETS, BR_ROADS, BR_STRUCTURES, BR_MAP, BR_NAV_NODES,
  brAuthoredDeckHeight, brRoadIntersectsFootprint, isInsideBrIslandInterior } from "./index.js";

describe("Lower civic frontage between Academy and Mall",()=>{
  const structures=BR_STRUCTURES.filter(s=>s.districtId==="civic-frontage");
  it("encloses the measured gap with three grounded and clear enterable parcels",()=>{
    expect(BR_MAP.diameter).toBe(1000);expect(structures).toHaveLength(3);
    expect(structures.map(s=>[s.id,s.position,s.entrance])).toEqual([
      ["civic-frontage-bookshop",{x:-165,y:0,z:170},"east"],
      ["civic-frontage-clinic",{x:-122,y:0,z:166},"west"],
      ["civic-frontage-service",{x:-122,y:0,z:145},"west"]
    ]);
    for(const s of structures){
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2]){
        const p={x:s.position.x+dx,z:s.position.z+dz};
        expect(isInsideBrIslandInterior(p,2),s.id).toBe(true);expect(brAuthoredDeckHeight(p),s.id).toBe(0);
      }
      for(const r of BR_ROADS)expect(brRoadIntersectsFootprint(r,s.position,s.size,1),`${s.id}: ${r.id}`).toBe(false);
      for(const o of BR_STRUCTURES.filter(o=>o.id!==s.id))expect(
        Math.abs(s.position.x-o.position.x)>=(s.size.x+o.size.x)/2+1||Math.abs(s.position.z-o.position.z)>=(s.size.z+o.size.z)/2+1,
        `${s.id}: ${o.id}`).toBe(true);
      expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.position.y<1)).toHaveLength(2);
    }
    const nearest=Math.min(...structures.map(s=>Math.hypot(Math.max(0,Math.abs(-170-s.position.x)-s.size.x/2),Math.max(0,Math.abs(170-s.position.z)-s.size.z/2))));
    expect(nearest).toBe(0);
  });
  it("extends the existing lower civic street without changing raised Academy or Mall roads",()=>{
    expect(BR_DISTRICT_PLANS.find(p=>p.id==="civic-frontage")).toMatchObject({origin:{x:-145,y:0,z:112},elevation:0,
      openZone:{position:{x:-145,y:0,z:180},radius:3,purpose:"courtyard"}});
    expect(BR_ROADS.filter(r=>r.id.startsWith("civic-frontage-"))).toEqual([
      {id:"civic-frontage-main",from:{x:-145,y:.1,z:112},to:{x:-145,y:.1,z:180},width:8,color:"#3b4058",kind:"local"},
      {id:"civic-frontage-court",from:{x:-145,y:.1,z:180},to:{x:-132,y:.1,z:180},width:6,color:"#3b4058",kind:"local",intentionalTerminus:true}
    ]);
    expect(BR_ROADS.find(r=>r.id==="central-security-cross")).toMatchObject({to:{x:-145,y:.1,z:112}});
    expect(BR_ROADS.find(r=>r.id==="astra-circulation-n")).toMatchObject({from:{x:-365,y:8.1,z:150},to:{x:-195,y:8.1,z:150}});
    expect(BR_ROADS.find(r=>r.id==="mall-circulation-s")).toMatchObject({from:{x:-180,y:2.433333333333333,z:190}});
    const junction=BR_NAV_NODES.find(n=>n.position.x===-145&&n.position.z===112&&Math.abs(n.position.y-.3)<.001)!;
    expect(junction).toBeDefined();
    expect(junction.neighbors.map(id=>BR_NAV_NODES.find(n=>n.id===id)!.position)).toContainEqual({x:-145,y:.1+.2,z:180});
    const queue=[junction.id],visited=new Set(queue);
    for(let i=0;i<queue.length;i++)for(const id of BR_NAV_NODES.find(n=>n.id===queue[i])!.neighbors){
      if(!visited.has(id)){visited.add(id);queue.push(id);}
    }
    expect(BR_NAV_NODES.some(n=>n.position.x===-70&&n.position.z===42&&visited.has(n.id))).toBe(true);
  });
});
