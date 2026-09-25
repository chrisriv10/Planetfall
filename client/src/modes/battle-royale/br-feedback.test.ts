import { describe, expect, it } from "vitest";
import { brActionTimer, brAstronautFacingRotation, brDamageBearing, brFireRequestDue, brPredictionCorrectionStrength, brRecoilAfter, brSmoothFacing, brStormReadout } from "./br-feedback";

describe("BR presentation correctness",()=>{
  it("shows a drop phase instead of a misleading expired storm countdown aboard the ship",()=>{
    expect(brStormReadout("ship",{stage:"waiting",stageEndsAt:null},100)).toEqual({label:"DROP PHASE",time:"—"});
    expect(brStormReadout("countdown",{stage:"waiting",stageEndsAt:100},100)).toEqual({label:"PREPARING",time:"—"});
  });
  it("restores the correct storm countdown in combat and clamps expired deadlines",()=>{
    expect(brStormReadout("combat",{stage:"closing",stageEndsAt:62_000},1000)).toEqual({label:"VOID CLOSING",time:"01:01"});
    expect(brStormReadout("combat",{stage:"waiting",stageEndsAt:1000},2000)).toEqual({label:"VOID STORM",time:"00:00"});
  });
  it("turns through the short arc across the yaw wrap",()=>{
    expect(brSmoothFacing(Math.PI-.01,-Math.PI+.01,.05)).toBeGreaterThan(Math.PI-.01);
    expect(Math.abs(brSmoothFacing(Math.PI-.01,-Math.PI+.01,.05)-Math.PI)).toBeLessThan(.01);
  });
  it("converts gameplay yaw into the canonical astronaut's Three.js facing convention",()=>{
    for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      // The shared astronaut faces local +Z and its BR child rig has a PI
      // correction. Transform that model-forward vector through the outer
      // rotation and compare it with BR's camera-relative movement forward.
      const modelRotation=brAstronautFacingRotation(yaw)+Math.PI;
      const modelForward={x:Math.sin(modelRotation),z:Math.cos(modelRotation)};
      const movementForward={x:Math.sin(yaw),z:-Math.cos(yaw)};
      expect(modelForward.x).toBeCloseTo(movementForward.x,10);
      expect(modelForward.z).toBeCloseTo(movementForward.z,10);
    }
  });
  it("points toward attackers, not along their damage impulse",()=>{
    expect(brDamageBearing({x:0,z:1},0)).toBeCloseTo(0);
    expect(brDamageBearing({x:-1,z:0},0)).toBeCloseTo(Math.PI/2);
    expect(brDamageBearing({x:-1,z:0},Math.PI/2)).toBeCloseTo(0);
    expect(brDamageBearing({x:0,z:0},0)).toBeNull();
  });
  it("decays recoil identically at 30, 60 and 144 FPS",()=>{
    const sample=(fps:number)=>{let recoil=1;for(let i=0;i<fps;i++)recoil=brRecoilAfter(recoil,1/fps);return recoil;};
    expect(sample(30)).toBeCloseTo(sample(144),10);
    expect(sample(60)).toBeCloseTo(sample(144),10);
  });
  it("never advances held-fire prediction before the authoritative cooldown",()=>{
    expect(brFireRequestDue(999,100,900)).toBe(false);
    expect(brFireRequestDue(1000,100,900)).toBe(true);
    expect(brFireRequestDue(1000,100,0)).toBe(false);
    const requests:number[]=[];let last=0;
    for(let now=1000;now<=3000;now+=1000/60)if(brFireRequestDue(now,last,155)){requests.push(now);last=now;}
    expect(requests.length).toBeGreaterThanOrEqual(12);
    for(let index=1;index<requests.length;index++)expect(requests[index]-requests[index-1]).toBeGreaterThanOrEqual(155);
  });
  it("converts server action deadlines without mixing clock origins",()=>{
    expect(brActionTimer(1_002_000,1_000_000,400,0,0,3000,false)).toEqual({startedAt:-600,endsAt:2400,confirmed:true});
  });
  it("clears acknowledged cancellation and rejected anticipation",()=>{
    expect(brActionTimer(0,1000,150,100,2100,2000,true).endsAt).toBe(0);
    expect(brActionTimer(0,1000,150,100,2100,2000,false).endsAt).toBe(2100);
    expect(brActionTimer(0,1500,600,100,2100,2000,false).endsAt).toBe(0);
  });
  it("filters tiny prediction noise while retaining bounded convergence",()=>{
    expect(brPredictionCorrectionStrength(.05)).toBe(0);
    expect(brPredictionCorrectionStrength(.2)).toBeLessThan(.1);
    expect(brPredictionCorrectionStrength(.8)).toBeGreaterThan(.1);
    expect(brPredictionCorrectionStrength(2)).toBeLessThan(.5);
  });
});
