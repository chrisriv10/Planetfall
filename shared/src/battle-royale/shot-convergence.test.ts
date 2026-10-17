import {describe,it,expect} from "vitest";
import {brAimDirection,brShotDirectionAllowed} from "./math.js";
describe("shared muzzle convergence limits",()=>{
 it("accepts forward aim and modest convergence, but rejects a nearby target behind the muzzle",()=>{
  expect(brShotDirectionAllowed(brAimDirection(-.47,-.42),-.47,-.42)).toBe(true);
  expect(brShotDirectionAllowed({x:.3,y:0,z:-1},0,0)).toBe(true);
  expect(brShotDirectionAllowed({x:.72996,y:-.40641,z:.54954},-.47339,-.42)).toBe(false);
  expect(brShotDirectionAllowed({x:0,y:0,z:1},0,0)).toBe(false);
 });
 it("retains the existing .72 cone and rejects malformed directions",()=>{
  for(const dot of [.719,.721])expect(brShotDirectionAllowed({x:Math.sqrt(1-dot*dot),y:0,z:-dot},0,0)).toBe(dot>=.72);
  for(const direction of [{x:0,y:0,z:0},{x:NaN,y:0,z:-1},{x:Infinity,y:0,z:0}])expect(brShotDirectionAllowed(direction,0,0)).toBe(false);
 });
});
