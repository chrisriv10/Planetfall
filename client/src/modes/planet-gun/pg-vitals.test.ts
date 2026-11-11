import {describe,expect,it} from "vitest";
import {pgVitalPresentation} from "./pg-vitals";
describe("mode-owned vitals presentation",()=>{
 it("uses accepted hits rather than a damage-derived HP number for Zombies",()=>{
  expect(pgVitalPresentation(67,100,{hitCount:1,hitCapacity:3,life:"alive"})).toMatchObject({value:2,label:"HITS LEFT",fraction:2/3,critical:false});
  expect(pgVitalPresentation(128,160,{hitCount:1,hitCapacity:5,life:"alive"})).toMatchObject({value:4,fraction:.8});
  expect(pgVitalPresentation(33,100,{hitCount:2,hitCapacity:3,life:"alive"})).toMatchObject({value:1,critical:true});
 });
 it("retains maximum danger while a positive-HP downed pilot crawls",()=>{
  expect(pgVitalPresentation(1,100,{hitCount:3,hitCapacity:3,life:"downed"})).toEqual({value:0,label:"DOWNED",fraction:0,critical:true,downed:true});
 });
 it("clears danger on hit recovery and preserves ordinary hero HP scaling",()=>{
  expect(pgVitalPresentation(100,100,{hitCount:0,hitCapacity:3,life:"alive"})).toMatchObject({value:3,fraction:1,critical:false});
  expect(pgVitalPresentation(80,160)).toMatchObject({value:80,label:"HP",fraction:.5,critical:false});
 });
});
