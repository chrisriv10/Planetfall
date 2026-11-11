import {describe,it,expect} from "vitest";
import {updatePrFollowTarget} from "./pr-follow-target";
describe("PlanetRun stable follow target",()=>{
 it("attenuates alternating impact corrections at every shake level and never moves input angles",()=>{
  const amplitudes:number[]=[];
  for(const setting of ["off","reduced","full"] as const){
   const point={x:0,y:0,z:0};let peak=0;
   for(let i=0;i<120;i++){updatePrFollowTarget(point,{x:0,y:i%2?.35:-.35,z:0},1/60,setting);if(i>60)peak=Math.max(peak,Math.abs(point.y));}
   expect(peak).toBeLessThan(.04);amplitudes.push(peak);
  }
  expect(amplitudes[0]).toBeLessThan(amplitudes[1]);expect(amplitudes[1]).toBeLessThan(amplitudes[2]);
 });
 it("follows real falls and travel promptly, snaps subjects/teleports and bounds stalled-frame updates",()=>{
  const point={x:0,y:26,z:0};for(let i=0;i<60;i++)updatePrFollowTarget(point,{x:i*9/60,y:26-i*8/60,z:0},1/60,"off");
  expect(point.x).toBeGreaterThan(8.3);expect(point.y).toBeLessThan(19.3);
  updatePrFollowTarget(point,{x:point.x,y:11,z:0},1/60,"full");expect(point.y).toBe(11);
  updatePrFollowTarget(point,{x:90,y:3,z:0},1/60,"full");expect(point).toEqual({x:90,y:3,z:0});
  updatePrFollowTarget(point,{x:91,y:4,z:1},0,"full",true);expect(point).toEqual({x:91,y:4,z:1});
  const copy={...point};updatePrFollowTarget(point,{x:92,y:5,z:2},NaN,"full");expect(point).toEqual(copy);
  updatePrFollowTarget(point,{x:92,y:5,z:2},50,"full");expect(point.x).toBeLessThan(92);expect(point.y).toBeLessThan(5);
 });
});
