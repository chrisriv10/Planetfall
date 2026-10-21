import {describe,it,expect} from "vitest";
import {prControllerCamera} from "./pr-camera-input";
describe("PlanetRun controller camera",()=>{
  it("produces the same turn for the same elapsed simulation time",()=>{
    const integrate=(steps:number)=>{let view={yaw:0,pitch:0};for(let i=0;i<steps;i++)view=prControllerCamera(view.yaw,view.pitch,.8,.2,1/steps,1,false);return view;};
    expect(integrate(30).yaw).toBeCloseTo(integrate(60).yaw);expect(integrate(30).pitch).toBeCloseTo(integrate(60).pitch);
  });
  it("honors shared sensitivity, invert and dead zone without exceeding pitch limits",()=>{
    expect(prControllerCamera(0,0,.1,-.1,1,2,true)).toEqual({yaw:0,pitch:0});
    expect(prControllerCamera(0,0,.5,.5,.1,2,true)).toEqual({yaw:-.2,pitch:-.1});
    expect(prControllerCamera(0,1,0,1,1,2,false).pitch).toBe(1.1);
  });
});
