import { describe,expect,it } from "vitest";
import { BR_DISTRICT_PLANS,BR_LOOT_SOCKETS,BR_ROADS,BR_STRUCTURES,BR_MAP_BLOCKS,brAuthoredDeckHeight,brRoadGradeFloorAt,brRoadIntersectsFootprint,isInsideBrIslandInterior,BR_NAV_NODES } from "./index.js";

describe("Nova north descent and ground landing",()=>{
  const structures=BR_STRUCTURES.filter(s=>s.districtId==="nova-landing");
  it("connects the preserved upper stub to an actual ground landing",()=>{
    expect(BR_ROADS.find(r=>r.id==="nova-street-b-north-grade-part-1")).toMatchObject({to:{x:-175,y:4.836842105263158,z:-48}});
    expect(BR_ROADS.find(r=>r.id==="nova-north-descent")).toEqual({id:"nova-north-descent",from:{x:-175,y:4.836842105263158,z:-48},to:{x:-175,y:.1,z:-12},width:12,color:"#44385e",kind:"arterial"});
    expect(BR_DISTRICT_PLANS.find(p=>p.id==="nova-landing")).toMatchObject({origin:{x:-175,y:0,z:-12},elevation:0,
      openZone:{position:{x:-175,y:0,z:8},radius:3,purpose:"courtyard"}});
    const junction=BR_NAV_NODES.find(n=>n.position.x===-175&&n.position.z===-12)!;
    const neighbors=junction.neighbors.map(id=>BR_NAV_NODES.find(n=>n.id===id)!.position);
    for(const [x,z] of [[-175,-48],[-175,8],[-151,-12],[-198,-12]])expect(neighbors.some(p=>p.x===x&&p.z===z)).toBe(true);
  });
  it("grounds all three real shells and clears every street and neighboring building",()=>{
    expect(structures.map(s=>[s.id,s.position,s.entrance])).toEqual([
      ["nova-landing-shop",{x:-200,y:0,z:3},"east"],
      ["nova-landing-office",{x:-198,y:0,z:-27},"north"],
      ["nova-landing-service",{x:-151,y:0,z:-27},"north"]
    ]);
    for(const s of structures){
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2]){
        const p={x:s.position.x+dx,z:s.position.z+dz};expect(brAuthoredDeckHeight(p),s.id).toBe(0);expect(isInsideBrIslandInterior(p,2),s.id).toBe(true);
      }
      for(const r of BR_ROADS)expect(brRoadIntersectsFootprint(r,s.position,s.size,1),`${s.id}: ${r.id}`).toBe(false);
      for(const o of BR_STRUCTURES.filter(o=>o.id!==s.id))expect(Math.abs(s.position.x-o.position.x)>=(s.size.x+o.size.x)/2+1||Math.abs(s.position.z-o.position.z)>=(s.size.z+o.size.z)/2+1,`${s.id}: ${o.id}`).toBe(true);
      expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.position.y<1)).toHaveLength(2);
    }
  });
  it("puts actual enclosure within 12m of the measured gap",()=>{
    const nearest=Math.min(...structures.map(s=>Math.hypot(Math.max(0,Math.abs(-170-s.position.x)-s.size.x/2),Math.max(0,Math.abs(-20-s.position.z)-s.size.z/2))));
    expect(nearest).toBe(10);expect(nearest).toBeLessThan(12);
  });
  it("keeps the office threshold inside the real doorway and ends its grade at the actual floor",()=>{
    const threshold=BR_MAP_BLOCKS.find(b=>b.id==="nova-landing-office-threshold-surface")!;
    expect(threshold.kind).toBe("ramp");expect(threshold.districtId).toBe("nova-landing");
    expect(threshold.size.z).toBe(4.4);
    expect(brRoadGradeFloorAt(threshold,{x:-198,y:0,z:-17.5})).toBeCloseTo(0);
    expect(brRoadGradeFloorAt(threshold,{x:-198,y:0,z:-19})).toBeCloseTo(.36);
    expect(brRoadGradeFloorAt(threshold,{x:-198,y:0,z:-17.4})).toBeNull();
    expect(brRoadGradeFloorAt(threshold,{x:-198,y:0,z:-19.1})).toBeNull();
    for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,{x:-198,y:0,z:-18.25},{x:4.4,y:.36,z:1.5}),road.id).toBe(false);
  });
});
