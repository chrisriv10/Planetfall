import {describe,expect,it} from "vitest";
import {brWorldDrawDue} from "./br-render-cadence";

describe("BR tactical-map background draw cadence",()=>{
  it("never throttles normal gameplay, including the first frame after closing the map",()=>{
    for(const elapsed of [0,.1,8,16,100,125])expect(brWorldDrawDue(1000+elapsed,1000,false)).toBe(true);
  });
  it("bounds covered WebGL draws to eight per second with an exact non-drifting interval",()=>{
    expect(brWorldDrawDue(1000,Number.NEGATIVE_INFINITY,true)).toBe(true);
    for(const elapsed of [0,16,64,124.999])expect(brWorldDrawDue(1000+elapsed,1000,true)).toBe(false);
    expect(brWorldDrawDue(1125,1000,true)).toBe(true);
    let last=0,draws=0;
    for(let now=1;now<=1000;now++)if(brWorldDrawDue(now,last,true)){last=now;draws++;}
    expect(draws).toBe(8);
  });
});
