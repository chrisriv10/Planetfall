import { describe,expect,it } from "vitest";
import { BR_CRATE_SOCKETS,BR_MAP_BLOCKS,BR_POIS,BR_ROADS,BR_SECONDARY_CRATE_SOCKETS,
  BR_SECONDARY_LOCATIONS,BR_STRUCTURES,brFloorHeightAt,brRoadIntersectsFootprint,isInsideBrIslandInterior } from "./index.js";

// Includes the latch/corner armor, plus room to approach a crate. The shell is
// 1.76m wide and 1.2m deep; do not test just a point at its local origin.
const footprint={x:1.9,y:1.3,z:1.5};

describe("Authored Star Crate placement",()=>{
  it("keeps secondary crates outside road ribbons, doorway approaches and solid cover",()=>{
    for(const socket of BR_SECONDARY_CRATE_SOCKETS){
      const {districtId,position}=socket;
      expect(isInsideBrIslandInterior(position,2),districtId).toBe(true);
      for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,position,footprint,.5),`${districtId}: ${road.id}`).toBe(false);
      for(const block of BR_MAP_BLOCKS.filter(b=>b.kind==="wall"||b.kind==="cover")){
        const overlaps=Math.abs(position.x-block.position.x)<block.size.x/2+footprint.x/2+.5
          &&Math.abs(position.z-block.position.z)<block.size.z/2+footprint.z/2+.5
          &&position.y-.62<block.position.y+block.size.y/2
          &&position.y-.62+footprint.y>block.position.y-block.size.y/2;
        expect(overlaps,`${districtId}: ${block.id}`).toBe(false);
      }
      for(const building of BR_STRUCTURES.filter(s=>s.enterable)){
        const ns=building.entrance==="north"||building.entrance==="south";
        const sign=building.entrance==="north"||building.entrance==="east"?1:-1;
        const doorX=building.position.x+(ns?0:sign*(building.size.x/2+3));
        const doorZ=building.position.z+(ns?sign*(building.size.z/2+3):0);
        expect(Math.abs(position.x-doorX)<(ns?2.5:3)+footprint.x/2
          &&Math.abs(position.z-doorZ)<(ns?3:2.5)+footprint.z/2,`${districtId}: ${building.id} door`).toBe(false);
      }
      for(const building of BR_STRUCTURES)expect(Math.abs(position.x-building.position.x)<building.size.x/2+footprint.x/2+.5
        &&Math.abs(position.z-building.position.z)<building.size.z/2+footprint.z/2+.5,`${districtId}: ${building.id} shell`).toBe(false);
    }
  });

  it("preserves the supply count/order and sits on real base, terrace and sunken floors",()=>{
    expect(BR_SECONDARY_CRATE_SOCKETS.map(s=>s.districtId)).toEqual(BR_SECONDARY_LOCATIONS.filter((_,i)=>i%3===0).map(s=>s.id));
    expect(BR_CRATE_SOCKETS).toHaveLength(BR_POIS.length+BR_SECONDARY_CRATE_SOCKETS.length);
    expect(BR_CRATE_SOCKETS.slice(BR_POIS.length)).toEqual(BR_SECONDARY_CRATE_SOCKETS.map(s=>s.position));
    for(const {districtId,position} of BR_SECONDARY_CRATE_SOCKETS){
      for(const dx of [-footprint.x/2,0,footprint.x/2])for(const dz of [-footprint.z/2,0,footprint.z/2]){
        const point={...position,x:position.x+dx,z:position.z+dz};
        expect(brFloorHeightAt(point,point.y)-position.y,`${districtId}: ${dx},${dz}`).toBeCloseTo(-.62,5);
      }
    }
    const transit=BR_SECONDARY_CRATE_SOCKETS.find(s=>s.districtId==="transit-court")!;
    expect(transit.position).toEqual({x:122,y:-2.38,z:99.5});
  });
});
