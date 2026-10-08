import { describe,expect,it } from "vitest";
import { BR_DISTRICT_PLANS,BR_LOOT_SOCKETS,BR_MAP,BR_POIS,BR_ROADS,BR_SECONDARY_CRATE_SOCKETS,
  BR_STRUCTURES,brAuthoredDeckHeight,brRoadIntersectsFootprint,isInsideBrIslandInterior } from "./index.js";

const structures=BR_STRUCTURES.filter(s=>s.districtId==="solar-service");
const heightAt=(id:string,x:number,z:number)=>BR_ROADS.filter(r=>r.id===id||r.id.startsWith(`${id}-grade-part-`)).flatMap(r=>{
  const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,lengthSq=dx*dx+dz*dz;
  const t=((x-r.from.x)*dx+(z-r.from.z)*dz)/lengthSq;
  return t>=-1e-7&&t<=1+1e-7&&Math.hypot(x-r.from.x-dx*t,z-r.from.z-dz*t)<.001
    ?[r.from.y+(r.to.y-r.from.y)*t-.1]:[];
});

describe("Solar Rim authored service block",()=>{
  it("fills the open rim with facing, usable parcels without shrinking the island or moving the raised decks",()=>{
    expect(BR_MAP.diameter).toBe(1000);
    expect(BR_POIS).toHaveLength(9);
    expect(brAuthoredDeckHeight({x:130,z:294})).toBe(4);
    expect(structures.map(s=>[s.id,s.position,s.entrance,s.archetype])).toEqual([
      ["solar-service-1",{x:155,y:0,z:418},"east","shop"],
      ["solar-service-2",{x:205,y:0,z:414},"west","office"],
      ["solar-service-3",{x:153,y:0,z:437},"east","utility"]
    ]);
    const plan=BR_DISTRICT_PLANS.find(p=>p.id==="solar-service")!;
    expect(plan.origin).toEqual({x:180,y:0,z:416});
    expect(plan.openZone).toEqual({position:{x:191,y:0,z:433},radius:3,purpose:"yard"});
  });

  it("keeps complete footprints inside the tapered island and clear of roads",()=>{
    for(const s of structures){
      expect(s.enterable,s.id).toBe(true);
      expect(s.roofAccess,s.id).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2])
        expect(isInsideBrIslandInterior({x:s.position.x+dx,y:0,z:s.position.z+dz},2),s.id).toBe(true);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,1),`${s.id}: ${road.id}`).toBe(false);
    }
  });

  it("joins the real ring plane, holds past its shoulder, then descends before the ground junction",()=>{
    const upper=32/9;
    expect(heightAt("solar-service-access",225,372)).toEqual(heightAt("ring-n",225,372));
    for(const [z,y] of [[372,upper],[380,upper],[388.5,upper/2],[397,0],[400,0]]){
      const heights=heightAt("solar-service-access",225,z);
      expect(heights.length).toBeGreaterThan(0);
      for(const height of heights)expect(height).toBeCloseTo(y,5);
    }
    for(const id of ["solar-service-arrival","solar-service-cross","solar-service-access"])
      expect(heightAt(id,225,400)).toEqual([0]);
    for(const id of ["solar-service-arrival","solar-service-cross","solar-service-main","service-33"])
      expect(heightAt(id,180,400)).toEqual([0]);
    for(const z of [400,413,418,429,436])expect(heightAt("solar-service-main",180,z)).toEqual([0]);
  });

  it("provides floor loot in each accessible building and a clear service-yard crate",()=>{
    for(const s of structures){
      const ground=BR_LOOT_SOCKETS.filter(socket=>socket.structureId===s.id&&socket.position.y<1);
      expect(ground).toHaveLength(2);
      for(const socket of ground)expect(socket.position.y).toBeCloseTo(.58,5);
    }
    expect(BR_SECONDARY_CRATE_SOCKETS.find(s=>s.districtId==="solar-service")?.position)
      .toEqual({x:191,y:.62,z:433});
  });

  it("creates actual enclosure around the sampled gap rather than counting pavement as content",()=>{
    const point={x:180,z:420};
    const distances=structures.map(s=>Math.hypot(
      Math.max(0,Math.abs(s.position.x-point.x)-s.size.x/2),
      Math.max(0,Math.abs(s.position.z-point.z)-s.size.z/2)
    ));
    expect(Math.min(...distances)).toBe(14);
    expect(distances.filter(distance=>distance<=20)).toHaveLength(3);
  });
});
