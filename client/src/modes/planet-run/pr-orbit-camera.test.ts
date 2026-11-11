import {describe,it,expect} from "vitest";
import {prOrbitRadius,setPrOrbitPosition} from "./pr-orbit-camera";
describe("PlanetRun orbit clearance",()=>{
 it("retains full viewing distance through rapid side/front/behind turns instead of crossing the pilot",()=>{
  const target={x:2,y:4,z:-8},position={x:0,y:0,z:0};let radius=9;
  for(const yaw of [0,Math.PI,0,Math.PI/2,-Math.PI/2,Math.PI*4]){
   radius=prOrbitRadius(radius,9,9,1/60);setPrOrbitPosition(position,target,yaw,.38,radius);
   expect(Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)).toBeCloseTo(9);
  }
 });
 it("contracts immediately for actual obstacles and eases back out without penetrating the obstruction",()=>{
  expect(prOrbitRadius(9,9,2,1/60)).toBe(2);let radius=2;
  for(let i=0;i<30;i++){radius=prOrbitRadius(radius,9,9,1/60);expect(radius).toBeGreaterThan(2);expect(radius).toBeLessThan(9);}
  expect(radius).toBeGreaterThan(8.9);expect(prOrbitRadius(radius,9,1.5,1/60)).toBe(1.5);expect(prOrbitRadius(1.5,24,24,1/60,true)).toBe(24);
 });
});
