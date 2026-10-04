import {describe,expect,it} from "vitest";
import {BR_BALANCE,BR_ROADS,BR_VEHICLE_SPAWNS,brBlockPlanarHalfExtents,brBlocksNear,brFloorHeightAt,stepBrVehicle,type BrVehicleState} from "./index.js";

const vehicle=(overrides:Partial<BrVehicleState>={}):BrVehicleState=>({id:"v",spawnId:"s",kind:"hover-skimmer",position:{x:0,y:.44,z:0},velocity:{x:0,y:0,z:0},yaw:0,driverId:"p",...overrides});
describe("BR hover skimmer movement",()=>{
  it("uses fixed unique authored spawns",()=>{
    expect(BR_VEHICLE_SPAWNS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(BR_VEHICLE_SPAWNS.map(spawn=>spawn.id)).size).toBe(BR_VEHICLE_SPAWNS.length);
    expect(BR_VEHICLE_SPAWNS.every(spawn=>Object.values(spawn.position).every(Number.isFinite))).toBe(true);
  });
  it("parks every authored skimmer on a supported, obstruction-free bay",()=>{
    for(const spawn of BR_VEHICLE_SPAWNS){
      const floor=brFloorHeightAt(spawn.position,spawn.position.y+2.5);
      expect(spawn.position.y,spawn.id).toBeCloseTo(floor+BR_BALANCE.vehicle.hoverHeight,1);
      const blocked=brBlocksNear(spawn.position,BR_BALANCE.vehicle.collisionRadius+.2).some(block=>{
        if(block.kind==="platform"||block.kind==="bridge"||block.kind==="ramp")return false;
        const half=brBlockPlanarHalfExtents(block);
        return Math.abs(spawn.position.x-block.position.x)<=half.x+BR_BALANCE.vehicle.collisionRadius&&Math.abs(spawn.position.z-block.position.z)<=half.z+BR_BALANCE.vehicle.collisionRadius;
      });
      expect(blocked,spawn.id).toBe(false);
    }
  });
  it("accelerates, steers, brakes and respects bounded speed",()=>{
    let state=vehicle();
    for(let i=0;i<100;i++)state=stepBrVehicle(state,{moveX:.6,moveY:1},1/30);
    expect(Math.hypot(state.velocity.x,state.velocity.z)).toBeLessThanOrEqual(BR_BALANCE.vehicle.maxSpeed+.001);
    expect(state.yaw).toBeGreaterThan(0);
    const moving=Math.hypot(state.velocity.x,state.velocity.z);
    for(let i=0;i<30;i++)state=stepBrVehicle(state,{moveX:0,moveY:0},1/30);
    expect(Math.hypot(state.velocity.x,state.velocity.z)).toBeLessThan(moving);
  });
  it("follows every authored raised-road grade instead of driving below it",()=>{
    const grades=BR_ROADS.filter(road=>road.id.endsWith("-grade"));
    expect(grades.length).toBeGreaterThanOrEqual(8);
    for(const road of grades){
      let previousFloor=Math.min(road.from.y,road.to.y)-.1;
      const ascending=road.from.y>road.to.y;
      for(let index=0;index<=20;index++){
        const amount=ascending?index/20:1-index/20;
        const position={
          x:road.to.x+(road.from.x-road.to.x)*amount,
          y:previousFloor+BR_BALANCE.vehicle.hoverHeight,
          z:road.to.z+(road.from.z-road.to.z)*amount
        };
        const expected=road.to.y+(road.from.y-road.to.y)*amount-.1;
        const floor=brFloorHeightAt(position,previousFloor+BR_BALANCE.vehicle.hoverHeight+2.5);
        // The broad destination deck may take over slightly before the ribbon
        // endpoint; it may raise the skimmer onto that deck, never below the
        // authored grade or above the final supported surface.
        expect(floor+1e-5,`${road.id} at ${amount}`).toBeGreaterThanOrEqual(expected);
        expect(floor,`${road.id} at ${amount}`).toBeLessThanOrEqual(Math.max(road.from.y,road.to.y)-.1+1e-5);
        expect(floor+1e-5,road.id).toBeGreaterThanOrEqual(previousFloor);
        previousFloor=floor;
      }
    }
  });
});
