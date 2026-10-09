import { describe, expect, it } from "vitest";
import { brConstrainBaseDeckMovement } from "./movement.js";
describe("base-deck wall contact",()=>{
  it("prevents a wall autostep from sinking the feet below the solid ground",()=>{
    expect(brConstrainBaseDeckMovement({x:70,y:.035,z:70},{x:.1,y:-.08,z:0})).toBe(0);
  });
  it("preserves falling, jumps, the lower court and the island's exterior",()=>{
    expect(brConstrainBaseDeckMovement({x:70,y:10,z:70},{x:.1,y:-.08,z:0})).toBe(-.08);
    expect(brConstrainBaseDeckMovement({x:70,y:.035,z:70},{x:.1,y:.1,z:0})).toBe(.1);
    expect(brConstrainBaseDeckMovement({x:137,y:-2.965,z:92},{x:0,y:-.08,z:0})).toBe(0);
    expect(brConstrainBaseDeckMovement({x:700,y:.035,z:700},{x:0,y:-.08,z:0})).toBe(-.08);
  });
});
