import {describe,expect,it} from "vitest";
import {brBotJumpFraction,brBotLandingTarget,isInsideBrIsland} from "./index.js";

describe("BR bot distribution",()=>{
  it("spreads forty drops across authored landing sockets without exact clumps",()=>{
    const targets=Array.from({length:40},(_,index)=>brBotLandingTarget(index,40,7331));
    expect(targets.every(target=>isInsideBrIsland(target))).toBe(true);
    const rounded=new Set(targets.map(target=>`${target.x.toFixed(1)}:${target.z.toFixed(1)}`));
    expect(rounded.size).toBeGreaterThanOrEqual(36);
    const occupiedCells=new Set(targets.map(target=>`${Math.round(target.x/55)}:${Math.round(target.z/55)}`));
    expect(occupiedCells.size).toBeGreaterThanOrEqual(15);
    expect(targets.some((target,index)=>targets.slice(index+1).some(other=>Math.hypot(target.x-other.x,target.z-other.z)<45))).toBe(true);
  });
  it("stratifies bot jumps through the safe Starliner window",()=>{
    const fractions=Array.from({length:39},(_,index)=>brBotJumpFraction(index,39,42));
    expect(fractions[0]).toBeGreaterThan(.13);expect(fractions.at(-1)).toBeLessThan(.79);
    expect(fractions.every((value,index)=>index===0||value>fractions[index-1])).toBe(true);
  });
});

