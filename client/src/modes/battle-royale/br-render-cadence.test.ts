import {describe,expect,it} from "vitest";
import {brWorldDrawDue,brLobbyPresentationDue,brShadowDrawDue,withBrShadowRefresh} from "./br-render-cadence";

describe("BR tactical-map background draw cadence",()=>{
  it("refreshes High shadows on the first frame and thirty times at rounded sixty-Hz timestamps",()=>{
    expect(brShadowDrawDue(0,Number.NEGATIVE_INFINITY)).toBe(true);
    expect(brShadowDrawDue(1016.7,1000)).toBe(false);
    expect(brShadowDrawDue(1033.3,1000)).toBe(true);
    let last=0,draws=0;
    for(let frame=1;frame<=60;frame++){
      const now=Math.round(frame*1000/60*10)/10;
      if(brShadowDrawDue(now,last)){last=now;draws++;}
    }
    expect(draws).toBe(30);
    expect(brShadowDrawDue(1000,0)).toBe(true);
  });
  it("preserves explicit invalidation and shared automatic updates after successful and failed draws",()=>{
    for(const automatic of [true,false])for(const pending of [true,false]){
      const map={autoUpdate:automatic,needsUpdate:pending};
      withBrShadowRefresh(map,false,()=>{
        expect(map.autoUpdate).toBe(false);expect(map.needsUpdate).toBe(pending);
      });
      expect(map.autoUpdate).toBe(automatic);
      expect(()=>withBrShadowRefresh(map,true,()=>{
        expect(map.needsUpdate).toBe(true);throw new Error("draw failure");
      })).toThrow("draw failure");
      expect(map.autoUpdate).toBe(automatic);
    }
  });
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

  it("bounds only lobby/results scenery and immediately releases the gameplay frame",()=>{
    for(const phase of ["ship","combat","countdown",undefined])expect(brLobbyPresentationDue(1000,1000,phase)).toBe(true);
    for(const phase of ["lobby","results"]){
      expect(brLobbyPresentationDue(1000,Number.NEGATIVE_INFINITY,phase)).toBe(true);
      expect(brLobbyPresentationDue(1049,1000,phase)).toBe(false);
      expect(brLobbyPresentationDue(1050,1000,phase)).toBe(true);
      let last=0,updates=0;
      for(let now=1;now<=1000;now++)if(brLobbyPresentationDue(now,last,phase)){last=now;updates++;}
      expect(updates).toBe(20);
    }
  });
});
