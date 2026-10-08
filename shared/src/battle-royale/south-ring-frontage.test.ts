import { describe, expect, it } from "vitest";
import { BR_DISTRICT_PLANS, BR_LOOT_SOCKETS, BR_MAP, BR_NAV_NODES, BR_POIS, BR_ROADS, BR_ROAD_ROUTES, BR_STRUCTURES,
  brAuthoredDeckHeight, brRoadIntersectsFootprint, isInsideBrIslandInterior } from "./index.js";

const structures=BR_STRUCTURES.filter(s=>s.districtId==="ring-service");

describe("Salvage Crossing road-first block",()=>{
  it("frames the existing ring with four facing parcels and an intentional loading court",()=>{
    expect(BR_MAP.diameter).toBe(1000);expect(BR_POIS).toHaveLength(9);
    expect(structures.map(s=>[s.id,s.position,s.entrance,s.archetype])).toEqual([
      ["ring-service-shop",{x:-232,y:0,z:-315},"east","shop"],
      ["ring-service-office",{x:-188,y:0,z:-315},"west","office"],
      ["ring-service-warehouse",{x:-232,y:0,z:-365},"east","warehouse"],
      ["ring-service-utility",{x:-188,y:0,z:-365},"west","utility"]
    ]);
    const plan=BR_DISTRICT_PLANS.find(p=>p.id==="ring-service")!;
    expect(plan.openZone).toEqual({position:{x:-210,y:0,z:-386},radius:4,purpose:"yard"});
    expect(BR_ROAD_ROUTES.find(r=>r.id==="ring-service-main")).toMatchObject({from:{x:-210,y:.1,z:-290},to:{x:-210,y:.1,z:-386},width:8});
    expect(BR_ROADS.filter(r=>r.id.startsWith("ring-service-main")).map(r=>[r.from,r.to])).toEqual([
      [{x:-210,y:.1,z:-290},{x:-210,y:.1,z:-340}],
      [{x:-210,y:.1,z:-340},{x:-210,y:.1,z:-386}]
    ]);
    const through=BR_ROADS.find(r=>r.id==="ring-s")!;
    expect(through.from).toEqual({x:-254,y:.1,z:-340});expect(through.to).toEqual({x:112,y:.1,z:-340});
  });

  it("keeps complete parcels on real ground, inside the island and clear of every road and neighbor",()=>{
    for(const s of structures){
      expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);
      for(const dx of [-s.size.x/2,s.size.x/2])for(const dz of [-s.size.z/2,s.size.z/2]){
        const point={x:s.position.x+dx,y:0,z:s.position.z+dz};
        expect(isInsideBrIslandInterior(point,2),s.id).toBe(true);
        expect(brAuthoredDeckHeight(point),s.id).toBe(0);
      }
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,1),`${s.id}: ${road.id}`).toBe(false);
      for(const other of BR_STRUCTURES.filter(other=>other.id!==s.id))
        expect(Math.abs(s.position.x-other.position.x)>=(s.size.x+other.size.x)/2+1||Math.abs(s.position.z-other.position.z)>=(s.size.z+other.size.z)/2+1,`${s.id}: ${other.id}`).toBe(true);
    }
  });

  it("provides reachable floor loot in every parcel without exterior roof ramps",()=>{
    for(const s of structures){
      const ground=BR_LOOT_SOCKETS.filter(socket=>socket.structureId===s.id&&socket.position.y<1);
      expect(ground,s.id).toHaveLength(2);
      for(const socket of ground)expect(socket.position.y).toBeCloseTo(.58,5);
      expect(BR_LOOT_SOCKETS.filter(socket=>socket.structureId===s.id&&socket.kind==="roof")).toHaveLength(0);
    }
  });

  it("adds real enclosure to the audited ring gap rather than counting pavement",()=>{
    const point={x:-210,z:-340};
    const nearest=Math.min(...structures.map(s=>Math.hypot(Math.max(0,Math.abs(point.x-s.position.x)-s.size.x/2),Math.max(0,Math.abs(point.z-s.position.z)-s.size.z/2))));
    expect(nearest).toBeCloseTo(Math.hypot(12,15),8);
    expect(nearest).toBeLessThan(20);
  });

  it("gives bots the actual four-way crossing instead of a detour through the northern avenue",()=>{
    const crossing=BR_NAV_NODES.find(node=>node.position.x===-210&&node.position.z===-340);
    expect(crossing,"visible ring junction waypoint").toBeDefined();
    expect(crossing!.position.y).toBeCloseTo(.3,8);
    const neighbors=crossing!.neighbors.map(id=>BR_NAV_NODES.find(node=>node.id===id)!.position);
    for(const [x,z] of [[-210,-290],[-210,-386],[-254,-340],[112,-340]])
      expect(neighbors.some(point=>point.x===x&&point.z===z),`junction branch ${x},${z}`).toBe(true);
  });
});
