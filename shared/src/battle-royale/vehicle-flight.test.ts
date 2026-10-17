import {describe,it,expect} from "vitest";
import {brResolveFlight,stepBrVehicle,type BrVehicleState} from "./index.js";
const aircraft:BrVehicleState={id:"flight",spawnId:"test",kind:"ion-shuttle",driverId:"pilot",position:{x:0,y:20,z:-80},velocity:{x:0,y:0,z:-30},yaw:0};
describe("aircraft sweep and flight envelope",()=>{
  it("checks wing motion when turning in place instead of skipping a zero-length center path",()=>{
    let probes=0;
    const result=brResolveFlight(aircraft,{...aircraft,yaw:Math.PI/2},0,(_origin,_direction,max)=>{probes++;return Math.min(.5,max);});
    expect(probes).toBeGreaterThan(0);
    expect(result.yaw).toBeGreaterThan(0);expect(result.yaw).toBeLessThan(Math.PI/2);
    expect(result.position).toEqual(aircraft.position);
  });
  it("protects the occupied seat headroom during ascent",()=>{
    let highest=0;
    const result=brResolveFlight(aircraft,{...aircraft,position:{...aircraft.position,y:21}},0,(origin,_direction,max)=>{highest=Math.max(highest,origin.y);return origin.y>22.5?.1:max;});
    expect(highest).toBeCloseTo(22.8);expect(result.position.y).toBeLessThan(20.03);
  });
  it("stops before a swept obstruction even if the intended endpoint is past it",()=>{
    const intent=stepBrVehicle(aircraft,{moveX:0,moveY:1,lift:0},.1);
    const resolved=brResolveFlight(aircraft,intent,0,()=>.5);
    expect(Math.abs(resolved.position.z-aircraft.position.z)).toBeCloseTo(.42);
    expect(resolved.velocity).toEqual({x:0,y:0,z:0});
  });
  it("respects landing height and the fixed upper flight envelope",()=>{
    const below=brResolveFlight({...aircraft,position:{x:0,y:.9,z:-80}},{...aircraft,position:{x:0,y:-20,z:-80}},0,(_o,_d,max)=>max);
    expect(below.position.y).toBeCloseTo(.8);
    const above=brResolveFlight(aircraft,{...aircraft,position:{x:0,y:999,z:-80}},0,(_o,_d,max)=>max);
    expect(above.position.y).toBe(165);
  });
  it("refuses travel beyond the fixed island flight boundary",()=>{
    const result=brResolveFlight(aircraft,{...aircraft,position:{x:999,y:20,z:999}},0,(_o,_d,max)=>max);
    expect(result.position).toEqual(aircraft.position);
  });
});
