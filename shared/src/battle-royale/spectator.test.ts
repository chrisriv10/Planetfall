import { describe, expect, it } from "vitest";
import { brSpectatorPriority, preferBrSpectator, type BrSpectatorCandidate } from "./spectator";

const candidate=(deployment:BrSpectatorCandidate["deployment"],y:number,extra:Partial<BrSpectatorCandidate>={}):BrSpectatorCandidate=>({
  alive:true,downed:false,grounded:deployment==="grounded",deployment,position:{y},...extra
});

describe("Battle Royale spectator target preference",()=>{
  it("prefers a grounded player over one falling beneath the island",()=>{
    const falling=candidate("chute",-12),grounded=candidate("grounded",.4);
    expect(preferBrSpectator([falling,grounded])).toBe(grounded);
  });
  it("keeps valid drop-phase pilots ahead of below-deck targets",()=>{
    expect(brSpectatorPriority(candidate("freefall",80))).toBeLessThan(brSpectatorPriority(candidate("freefall",-4)));
  });
  it("never selects an eliminated or non-finite target over a valid player",()=>{
    const valid=candidate("grounded",.4);
    expect(preferBrSpectator([candidate("eliminated",0,{alive:false}),candidate("grounded",Number.NaN),valid])).toBe(valid);
  });
});
