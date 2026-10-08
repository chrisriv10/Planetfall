import { describe,expect,it } from "vitest";
import { BR_DISTRICT_PLANS,BR_LOOT_SOCKETS,BR_NAV_NODES,BR_ROADS,BR_STRUCTURES,brAuthoredDeckHeight,brRoadIntersectsFootprint,isInsideBrIslandInterior } from "./index.js";

describe("West Junction ground frontage and Nova grade",()=>{
  it("holds the western frontage on ground and climbs only after the last entrance",()=>{
    const pieces=BR_ROADS.filter(r=>r.id.startsWith("west-transit-avenue"));
    expect(pieces.map(r=>[r.from,r.to])).toEqual([
      [{x:-375,y:.1,z:-125},{x:-330,y:.1,z:-128.71900826446281}],
      [{x:-330,y:.1,z:-128.71900826446281},{x:-300,y:.1,z:-131.19834710743802}],
      [{x:-300,y:.1,z:-131.19834710743802},{x:-262,y:5.1,z:-134.3388429752066}],
      [{x:-262,y:5.1,z:-134.3388429752066},{x:-254,y:5.1,z:-135}]
    ]);
    expect(Math.atan2(5,Math.hypot(38,3.14049586776858))*180/Math.PI).toBeLessThan(8);
  });
  it("authors three distinct enterable parcels around an actual street rather than an unsupported elevated road",()=>{
    const structures=BR_STRUCTURES.filter(s=>s.districtId==="west-junction");
    expect(structures.map(s=>[s.id,s.position,s.entrance,s.archetype])).toEqual([
      ["west-junction-shop",{x:-312,y:0,z:-103},"south","shop"],
      ["west-junction-office",{x:-294,y:0,z:-163},"north","office"],
      ["west-junction-utility",{x:-352,y:0,z:-152},"east","utility"]
    ]);
    for(const s of structures){
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2]){
        const corner={x:s.position.x+dx,z:s.position.z+dz};
        expect(isInsideBrIslandInterior(corner,2),s.id).toBe(true);
        expect(brAuthoredDeckHeight(corner),s.id).toBe(0);
      }
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,1),`${s.id}: ${road.id}`).toBe(false);
      for(const other of BR_STRUCTURES.filter(o=>o.id!==s.id))
        expect(Math.abs(s.position.x-other.position.x)>=(s.size.x+other.size.x)/2+1||Math.abs(s.position.z-other.position.z)>=(s.size.z+other.size.z)/2+1,`${s.id}: ${other.id}`).toBe(true);
      expect(BR_LOOT_SOCKETS.filter(socket=>socket.structureId===s.id&&socket.position.y<1),s.id).toHaveLength(2);
    }
  });
  it("connects the street to the existing collector and keeps a reserved service court",()=>{
    const plan=BR_DISTRICT_PLANS.find(p=>p.id==="west-junction")!;
    expect(plan).toBeDefined();
    expect(plan.origin).toEqual({x:-330,y:0,z:-128.71900826446281});
    expect(plan.openZone).toEqual({position:{x:-330,y:0,z:-180},radius:3,purpose:"yard"});
    const crossing=BR_NAV_NODES.find(n=>n.position.x===-330&&Math.abs(n.position.z+128.71900826446281)<1e-6);
    expect(crossing).toBeDefined();
    const neighbors=crossing!.neighbors.map(id=>BR_NAV_NODES.find(n=>n.id===id)!.position);
    for(const [x,z] of [[-375,-125],[-300,-131.19834710743802],[-330,-118],[-330,-142]])
      expect(neighbors.some(p=>Math.hypot(p.x-x,p.z-z)<1e-6),`real junction branch ${x},${z}`).toBe(true);
  });
});
