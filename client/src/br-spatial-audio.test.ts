import { describe, expect, it } from "vitest";
import { brSpatialMix, brShotFlybyPoint } from "./br-spatial-audio";

const listener = { x: 0, y: 0, z: 0 };
describe("BR spatial sound", () => {
  it("places sounds on the camera's right and left, including after turning", () => {
    expect(brSpatialMix({x:10,y:0,z:0},listener,0).pan).toBeGreaterThan(.8);
    expect(brSpatialMix({x:-10,y:0,z:0},listener,0).pan).toBeLessThan(-.8);
    expect(brSpatialMix({x:0,y:0,z:10},listener,Math.PI/2).pan).toBeGreaterThan(.8);
    expect(brSpatialMix({x:0,y:0,z:-10},listener,Math.PI/2).pan).toBeLessThan(-.8);
  });
  it("attenuates and darkens distant shots rather than playing them globally", () => {
    const near=brSpatialMix({x:0,y:0,z:-5},listener,0), far=brSpatialMix({x:0,y:0,z:-130},listener,0);
    expect(near.gain).toBeGreaterThan(far.gain*5);
    expect(near.cutoff).toBeGreaterThan(far.cutoff);
    expect(brSpatialMix({x:0,y:0,z:-181},listener,0).gain).toBe(0);
    expect(brSpatialMix({x:0,y:40,z:0},listener,0,32).gain).toBe(0);
  });
  it("silences malformed positions and stays centered at the listener", () => {
    expect(brSpatialMix({x:NaN,y:0,z:0},listener,0).gain).toBe(0);
    expect(brSpatialMix(listener,listener,0).pan).toBe(0);
    expect(brSpatialMix(listener,listener,0).gain).toBe(1);
  });
  it("only cues flybys that actually pass near the listener before an impact",()=>{
    const origin={x:4,y:1,z:20},direction={x:0,y:0,z:-1};
    expect(brShotFlybyPoint(origin,direction,40,listener)).toEqual({x:4,y:1,z:0});
    expect(brShotFlybyPoint(origin,direction,10,listener)).toBeNull();
    expect(brShotFlybyPoint(origin,{x:0,y:0,z:1},40,listener)).toBeNull();
    expect(brShotFlybyPoint({...origin,x:7},direction,40,listener)).toBeNull();
    expect(brShotFlybyPoint(origin,{x:0,y:0,z:0},40,listener)).toBeNull();
    expect(brShotFlybyPoint(origin,direction,Infinity,listener)).toBeNull();
  });
});
