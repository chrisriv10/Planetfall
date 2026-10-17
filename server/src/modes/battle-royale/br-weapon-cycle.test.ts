import {describe,it,expect} from "vitest";
import {BR_WEAPONS} from "@planetfall/shared";
import {BrWeaponCycle} from "./br-weapon-cycle.js";

describe("authoritative weapon timing",()=>{
  it("schedules three spaced Helix shots without multiplying ammo on a stalled tick",()=>{
    const cycle=new BrWeaponCycle(),weapon=BR_WEAPONS["helix-burst-rifle"];
    expect(cycle.request(weapon,true,0)).toBe(true);
    expect(cycle.request(weapon,true,89)).toBe(false);
    expect(cycle.request(weapon,false,90)).toBe(true);
    expect(cycle.request(weapon,false,1000)).toBe(true);
    expect(cycle.request(weapon,false,1000)).toBe(false);
  });
  it("requires a release between hand-cannon shots",()=>{
    const cycle=new BrWeaponCycle(),weapon=BR_WEAPONS["comet-hand-cannon"];
    expect(cycle.request(weapon,true,0)).toBe(true);
    expect(cycle.request(weapon,true,1000)).toBe(false);
    cycle.request(weapon,false,1100);
    expect(cycle.request(weapon,true,1200)).toBe(true);
  });
  it("cancels charge on release and waits a full new charge window",()=>{
    const cycle=new BrWeaponCycle(),weapon=BR_WEAPONS["vortex-cannon"];
    expect(cycle.request(weapon,true,0)).toBe(false);
    expect(cycle.request(weapon,true,799)).toBe(false);
    cycle.request(weapon,false,799);
    expect(cycle.request(weapon,true,800)).toBe(false);
    expect(cycle.request(weapon,true,1600)).toBe(true);
  });
  it("bounds beam ticks and enforces overheat hysteresis",()=>{
    const cycle=new BrWeaponCycle(),weapon=BR_WEAPONS["prism-beam"];
    for(let i=0;i<20;i++)expect(cycle.request(weapon,true,i*100)).toBe(true);
    expect(cycle.heat).toBe(100);
    expect(cycle.request(weapon,true,3200)).toBe(false);
    cycle.cool(weapon,1);
    expect(cycle.request(weapon,true,4200)).toBe(false);
    cycle.cool(weapon,2);
    expect(cycle.request(weapon,true,6200)).toBe(true);
  });
  it("cancels unfinished bursts when the inventory instance stops being active",()=>{
    const cycle=new BrWeaponCycle(),weapon=BR_WEAPONS["helix-burst-rifle"];
    cycle.request(weapon,true,0);cycle.cancel();
    expect(cycle.request(weapon,false,100)).toBe(false);
  });
});
