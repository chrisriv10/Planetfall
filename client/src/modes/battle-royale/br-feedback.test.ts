import { describe, expect, it } from "vitest";
import { brActionTimer, brDamageBearing, brRecoilAfter, brSmoothFacing } from "./br-feedback";

describe("BR presentation correctness",()=>{
  it("turns through the short arc across the yaw wrap",()=>{
    expect(brSmoothFacing(Math.PI-.01,-Math.PI+.01,.05)).toBeGreaterThan(Math.PI-.01);
    expect(Math.abs(brSmoothFacing(Math.PI-.01,-Math.PI+.01,.05)-Math.PI)).toBeLessThan(.01);
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
  it("converts server action deadlines without mixing clock origins",()=>{
    expect(brActionTimer(1_002_000,1_000_000,400,0,0,3000,false)).toEqual({startedAt:-600,endsAt:2400,confirmed:true});
  });
  it("clears acknowledged cancellation and rejected anticipation",()=>{
    expect(brActionTimer(0,1000,150,100,2100,2000,true).endsAt).toBe(0);
    expect(brActionTimer(0,1000,150,100,2100,2000,false).endsAt).toBe(2100);
    expect(brActionTimer(0,1500,600,100,2100,2000,false).endsAt).toBe(0);
  });
});
