import {describe,it,expect} from "vitest";
import {BR_TEAM_VEHICLE_SPAWNS,BR_VEHICLE_DEFINITIONS,brBlocksNear,brBlockPlanarHalfExtents,brBoardVehicle,brLeaveVehicle,brVehicleSeatIndex,brVehicleSeatPosition,stepBrVehicle,type BrVehicleState} from "./index.js";
const make=(kind:BrVehicleState["kind"]):BrVehicleState=>({id:"team-vehicle",spawnId:"test",kind,driverId:null,position:{x:0,y:.8,z:0},velocity:{x:0,y:0,z:0},yaw:0});
describe("shared vehicle seats and flight intent",()=>{
  it("places team transport bays outside solid building footprints",()=>{
    for(const spawn of BR_TEAM_VEHICLE_SPAWNS){const radius=BR_VEHICLE_DEFINITIONS[spawn.kind!].collisionRadius;
      for(const block of brBlocksNear(spawn.position,radius)){
        if(block.kind==="platform"||block.kind==="bridge"||block.kind==="ramp")continue;
        if(block.position.y+block.size.y/2<spawn.position.y-.25||block.position.y-block.size.y/2>spawn.position.y+2)continue;
        const half=brBlockPlanarHalfExtents(block);
        expect(Math.abs(spawn.position.x-block.position.x)>half.x+radius||Math.abs(spawn.position.z-block.position.z)>half.z+radius,`${spawn.id} intersects ${block.id}`).toBe(true);
      }
    }
  });
  it("boards four unique rover occupants, refuses overflow and reuses freed seats",()=>{
    const vehicle=make("relay-rover");
    for(let i=0;i<4;i++)expect(brBoardVehicle(vehicle,`pilot-${i}`)).toBe(i);
    expect(brBoardVehicle(vehicle,"extra")).toBe(-1);
    expect(brBoardVehicle(vehicle,"pilot-2")).toBe(2);
    brLeaveVehicle(vehicle,"pilot-1");expect(brBoardVehicle(vehicle,"extra")).toBe(1);
    expect(brVehicleSeatIndex(vehicle,"stranger")).toBe(-1);
    expect(new Set([vehicle.driverId,...vehicle.passengerIds!]).size).toBe(4);
  });
  it("keeps passengers seated when the driver leaves and stops driverless intent",()=>{
    const vehicle=make("ion-shuttle");brBoardVehicle(vehicle,"driver");brBoardVehicle(vehicle,"friend");vehicle.velocity={x:10,y:5,z:0};
    brLeaveVehicle(vehicle,"driver");expect(vehicle.driverId).toBeNull();expect(brVehicleSeatIndex(vehicle,"friend")).toBe(1);expect(vehicle.velocity).toEqual({x:0,y:0,z:0});
    expect(brBoardVehicle(vehicle,"new-driver")).toBe(0);
  });
  it("rotates distinct seat offsets with the vehicle",()=>{
    const vehicle=make("relay-rover"),front=brVehicleSeatPosition(vehicle,0),other=brVehicleSeatPosition(vehicle,1);
    expect(front.x).not.toBe(other.x);vehicle.yaw=Math.PI/2;
    const rotated=brVehicleSeatPosition(vehicle,0);expect(Math.hypot(rotated.x,rotated.z)).toBeCloseTo(Math.hypot(front.x,front.z));expect(rotated.y).toBe(front.y);
  });
  it("smoothly lifts only aircraft and clamps requested vertical input",()=>{
    const shuttle=make("ion-shuttle"),rover=make("relay-rover");
    const flying=stepBrVehicle(shuttle,{moveX:0,moveY:0,lift:100},.1);
    expect(flying.velocity.y).toBeCloseTo(1.6);expect(flying.position.y).toBeCloseTo(.96);
    expect(stepBrVehicle(rover,{moveX:0,moveY:0,lift:1},.1).position.y).toBe(rover.position.y);
  });
});
