import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_LOOT_SOCKETS, BR_MAP, BR_NAV_NODES, BR_POIS, BR_ROADS, BR_STRUCTURES, BR_TERRACES,
  brAuthoredDeckHeight, brRoadIntersectsFootprint, isInsideBrIslandInterior } from "./index.js";

const structures=BR_STRUCTURES.filter(s=>s.districtId==="transfer-yard");
describe("South Transfer ground arrival",()=>{
  it("adds three facing entrances while preserving the large island and raised bridge/decks",()=>{
    expect(BR_MAP.diameter).toBe(1000);expect(BR_POIS).toHaveLength(9);
    expect(BR_TERRACES.find(t=>t.id==="south-terminal-deck")).toMatchObject({position:{x:15,y:0,z:-415},size:{x:70,z:66},height:3.5});
    expect(BR_TERRACES.find(t=>t.id==="south-shipworks-deck")).toMatchObject({position:{x:190,y:0,z:-400},size:{x:70,z:66},height:4});
    expect(BR_ROADS.find(r=>r.id==="south-transfer-bridge")).toMatchObject({from:{x:45,y:3.6,z:-415},to:{x:160,y:4.1,z:-400},width:9});
    expect(structures.map(s=>[s.id,s.position,s.entrance,s.archetype])).toEqual([
      ["transfer-yard-shop",{x:78,y:0,z:-365},"east","shop"],
      ["transfer-yard-office",{x:128,y:0,z:-372},"west","office"],
      ["transfer-yard-utility",{x:76,y:0,z:-391},"east","utility"]
    ]);
    expect(BR_DISTRICT_PLANS.find(p=>p.id==="transfer-yard")?.openZone)
      .toEqual({position:{x:115,y:0,z:-394},radius:3,purpose:"yard"});
  });
  it("keeps every footprint grounded, contained and clear of all roads and neighboring shells",()=>{
    expect(structures).toHaveLength(3);
    for(const s of structures){
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2]){
        const point={x:s.position.x+dx,z:s.position.z+dz};
        expect(isInsideBrIslandInterior(point,2),s.id).toBe(true);
        expect(brAuthoredDeckHeight(point),s.id).toBe(0);
      }
      for(const r of BR_ROADS)expect(brRoadIntersectsFootprint(r,s.position,s.size,1),`${s.id}: ${r.id}`).toBe(false);
      for(const o of BR_STRUCTURES.filter(o=>o.id!==s.id))expect(
        Math.abs(s.position.x-o.position.x)>=(s.size.x+o.size.x)/2+1||Math.abs(s.position.z-o.position.z)>=(s.size.z+o.size.z)/2+1,
        `${s.id}: ${o.id}`).toBe(true);
      expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.position.y<1)).toHaveLength(2);
      expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.kind==="roof")).toHaveLength(0);
    }
  });
  it("joins the actual ring and terminates before the bridge with supported ground streets",()=>{
    const roads=BR_ROADS.filter(r=>r.id.startsWith("transfer-yard-"));
    expect(roads).toHaveLength(2);
    for(const r of roads)expect([r.from.y,r.to.y]).toEqual([.1,.1]);
    expect(roads.find(r=>r.id==="transfer-yard-main")).toMatchObject({from:{x:102,y:.1,z:-340},to:{x:102,y:.1,z:-394},width:8});
    expect(roads.find(r=>r.id==="transfer-yard-court")).toMatchObject({from:{x:102,y:.1,z:-394},to:{x:125,y:.1,z:-394},intentionalTerminus:true});
    const junction=BR_NAV_NODES.find(n=>n.position.x===102&&n.position.z===-340);
    expect(junction).toBeDefined();
    const neighbors=junction!.neighbors.map(id=>BR_NAV_NODES.find(n=>n.id===id)!.position);
    for(const [x,z] of [[-254,-340],[112,-340],[102,-394]])expect(neighbors.some(p=>p.x===x&&p.z===z)).toBe(true);
  });
  it("encloses the audited gap with real building footprints",()=>{
    const nearest=Math.min(...structures.map(s=>Math.hypot(Math.max(0,Math.abs(110-s.position.x)-s.size.x/2),Math.max(0,Math.abs(-370-s.position.z)-s.size.z/2))));
    expect(nearest).toBe(8);expect(nearest).toBeLessThan(20);
  });
});
