import {describe,it,expect} from "vitest";
import {pgValidateModeAction} from "./mode-actions.js";
describe("mode intent boundary",()=>{
 it("copies only server-recognized intent fields",()=>{
  expect(pgValidateModeAction({kind:"buy",sequence:1,lifeId:2,itemId:"pulse",price:0,damage:999,credits:999})).toEqual({kind:"buy",sequence:1,lifeId:2,itemId:"pulse"});
 });
 it("rejects malformed variants before authority handlers execute",()=>{
  for(const p of [null,{},"buy",{kind:"buy",itemId:[]},{kind:"interact",targetId:3,held:true},{kind:"interact",targetId:"power",held:1},{kind:"drone",control:true,moveX:NaN,moveZ:0,yaw:0,pitch:0},{kind:"camera",cameraId:{}},{kind:"ability",slot:9},{kind:"ability",slot:0,position:{x:Infinity,y:0,z:0}},{kind:"select",characterId:"__proto__",loadout:{primary:"invalid"}}])expect(pgValidateModeAction(typeof p==="object"&&p?{sequence:1,lifeId:1,...p}:p)).toBeNull();
 });
 it("bounds sequence/life identity and copies positions without aliasing",()=>{
  expect(pgValidateModeAction({kind:"buy",sequence:-1,lifeId:1,itemId:"pulse"})).toBeNull();
  const position={x:2,y:0,z:5};const result=pgValidateModeAction({kind:"ability",sequence:3,lifeId:1,slot:0,position});position.x=10;expect(result?.kind==="ability"&&result.position?.x).toBe(2);
 });
});
