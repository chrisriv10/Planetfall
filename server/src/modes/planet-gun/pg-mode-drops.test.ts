import {expect,it} from "vitest";
import {PG_MAP,pgCapsuleClear} from "@planetfall/shared";
import {pgSupportedModeDrop} from "./pg-mode-drops.js";

it("settles airborne loot onto actual floors, keeping raised support",()=>{
 expect(pgSupportedModeDrop({x:0,y:2,z:16},PG_MAP)).toEqual({x:0,y:0,z:16});
 expect(pgSupportedModeDrop({x:-30.5,y:8,z:-19},PG_MAP)).toEqual({x:-30.5,y:6.8,z:-19});
});
it("recovers a void drop onto reachable supported ground instead of losing the charge",()=>{
 const point=pgSupportedModeDrop({x:49,y:-8,z:10},PG_MAP);
 expect(point.y).toBe(0);expect(Math.abs(point.x)).toBeLessThan(46);expect(pgCapsuleClear(point,1.95,PG_MAP)).toBe(true);
 expect(PG_MAP.solids.some(s=>Math.abs(s.center.y+s.half.y-point.y)<.01&&Math.abs(s.center.x-point.x)<=s.half.x&&Math.abs(s.center.z-point.z)<=s.half.z)).toBe(true);
});
