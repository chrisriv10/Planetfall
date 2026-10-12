import {describe,it,expect} from "vitest";
import type {BrStructure} from "@planetfall/shared";
import {buildBrNovaTowerPanelIdentity as build,type NovaPanel,type NovaPanelBounds} from "./br-nova-tower-panel-identity";
function fixture(side:number){
 const structure={id:"nova-tower-b",enterable:true,position:{x:-140,y:5,z:-172}} as BrStructure;
 const original:NovaPanel[]=[-.3,0,.3].map(x=>({position:{x:-140+25*x,y:2.1,z:-172+side*(13-.55)},scale:{x:5.75,y:2.5,z:.12}}));
 const wall:NovaPanelBounds={min:{x:-152.5,y:5,z:-172+side*13-.325},max:{x:-127.5,y:32,z:-172+side*13+.325}};
 const floor:NovaPanelBounds={min:{x:-152.5,y:4.8,z:-185},max:{x:-127.5,y:5.175,z:-159}};
 return {structure,original,wall,floor};
}
describe("Nova Tower B mounted maintenance cassettes",()=>{
 for(const side of [-1,1])it(`flush mounts on ${side} wall, preserving lateral/vertical envelope`,()=>{
  const f=fixture(side),before=JSON.stringify(f),r=build(f.structure,f.original,[f.wall],[f.floor],[]);
  expect(r).toHaveLength(3);expect(JSON.stringify(f)).toBe(before);
  for(const group of r){const old=f.original[group.index],inner=side>0?f.wall.min.z:f.wall.max.z;
   expect(group.parts).toHaveLength(7);
   for(const p of group.parts){
    expect(Math.abs(p.position.x-old.position.x)+p.scale.x/2).toBeLessThanOrEqual(old.scale.x/2+1e-9);
    expect(Math.abs(p.position.y-old.position.y)+p.scale.y/2).toBeLessThanOrEqual(old.scale.y/2+1e-9);
    const offset=(p.position.z-inner)*-side;
    expect(offset-p.scale.z/2).toBeGreaterThanOrEqual(.002-1e-9);expect(offset+p.scale.z/2).toBeLessThanOrEqual(.122+1e-9);
   }
   const backing=group.parts[0];expect((backing.position.z-inner)*-side-backing.scale.z/2).toBeCloseTo(.002);
   expect(group.parts.filter(p=>p.finish==="light").reduce((a,p)=>a+p.scale.x*p.scale.y,0)/(old.scale.x*old.scale.y)).toBeLessThan(.23);
   expect(group.parts.filter(p=>p.finish==="emissive").reduce((a,p)=>a+p.scale.x*p.scale.y,0)).toBeCloseTo(.0126);
  }
 });
 it("retains originals for unrelated interiors or missing support",()=>{
  const f=fixture(1);
  expect(build({...f.structure,id:"nova-tower-a"},f.original,[f.wall],[f.floor],[])).toEqual([]);
  expect(build(f.structure,f.original,[],[f.floor],[])).toEqual([]);
  expect(build(f.structure,f.original,[f.wall],[],[])).toEqual([]);
  expect(build(f.structure,f.original,[{...f.wall,max:{...f.wall.max,y:7}}],[f.floor],[])).toEqual([]);
 });
 it("clears preserved lower dado within the original panel envelope",()=>{
  const f=fixture(-1),dado={min:{x:-151.6,y:5.07,z:-184.615},max:{x:-128.4,y:5.97,z:-184.485}};
  const r=build(f.structure,f.original,[f.wall],[f.floor],[dado]);
  expect(r).toHaveLength(3);
  for(const group of r)expect(group.parts[0].scale.y).toBe(2.15);
 });
 it("rejects full groups intersecting supplied stair, door, loot or dressing clearance",()=>{
  const f=fixture(-1),blocking={min:{x:-151,y:5,z:-185},max:{x:-145,y:9,z:-183}};
  const r=build(f.structure,f.original,[f.wall],[f.floor],[blocking]);
  expect(r.map(p=>p.index)).toEqual([1,2]);
 });
});
