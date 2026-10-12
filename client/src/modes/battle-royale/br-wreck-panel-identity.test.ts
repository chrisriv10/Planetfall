import {describe,it,expect} from "vitest";
import {BR_STRUCTURES,BR_MAP_BLOCKS,BR_LOOT_SOCKETS} from "@planetfall/shared";
import {buildWreckInterior} from "./br-wreck";
import {buildBrWreckPanelIdentity as build} from "./br-wreck-panel-identity";
describe("wreck maintenance cassette faces",()=>{
 const s=BR_STRUCTURES.find(s=>s.id==="crash-fuselage")!;
 it("replaces ten faces at identical part count while preserving all other details",()=>{
  const source=buildWreckInterior(s),snapshot=JSON.stringify(source),result=build(s,source);
  expect(result).toHaveLength(source.length);expect(JSON.stringify(source)).toBe(snapshot);
  const changed=result.filter((p,i)=>p!==source[i]);expect(changed).toHaveLength(50);
  expect(changed.filter(p=>p.finish==="light")).toHaveLength(20);
  expect(changed.filter(p=>p.finish==="panel").reduce((sum,p)=>sum+p.scale.x*p.scale.y,0)).toBeLessThan(10*4.2*2.36*.23);
  source.forEach((p,i)=>{if(p.position.y>3.2||p.scale.z===.55)expect(result[i]).toBe(p);});
 });
 it("keeps replaced details within original fittings and wall footprint, away from loot and aisle",()=>{
  const source=buildWreckInterior(s),result=build(s,source);
  for(let i=0;i<result.length;i++){
   const p=result[i];if(p===source[i])continue;
   const side=Math.sign(p.position.z-s.position.z);
   const wall=BR_MAP_BLOCKS.find(b=>b.id===`${s.id}-${side>0?"north":"south"}`)!;
   expect(wall).toBeDefined();
   const face=source.find(f=>f.finish==="panel"&&f.scale.y===2.36&&Math.abs(f.position.z-p.position.z)<.1&&Math.abs(f.position.x-p.position.x)<2.1)!;
   expect(face).toBeDefined();
   expect(Math.abs(p.position.x-face.position.x)+p.scale.x/2).toBeLessThanOrEqual(face.scale.x/2+1e-9);
   expect(Math.abs(p.position.y-face.position.y)+p.scale.y/2).toBeLessThanOrEqual(face.scale.y/2+1e-9);
   expect(Math.abs(p.position.z-face.position.z)+p.scale.z/2).toBeLessThanOrEqual(.08+1e-9);
   expect(Math.abs(p.position.x-wall.position.x)+p.scale.x/2).toBeLessThan(wall.size.x/2);
   expect(p.position.y-p.scale.y/2).toBeGreaterThan(.3);expect(p.position.y+p.scale.y/2).toBeLessThan(wall.size.y);
   expect(Math.abs(p.position.z-s.position.z)-p.scale.z/2).toBeGreaterThan(7);
   expect(Math.abs(p.position.z-s.position.z)+p.scale.z/2).toBeLessThan(s.size.z/2-.325);
   for(const socket of BR_LOOT_SOCKETS.filter(l=>l.structureId===s.id&&l.kind==="interior"))
    expect(Math.abs(p.position.x-socket.position.x)<p.scale.x/2+.7&&Math.abs(p.position.z-socket.position.z)<p.scale.z/2+.7).toBe(false);
   // Entire transformed fitting stays in the same narrow wall-side envelope.
   expect(p.position.y-p.scale.y/2).toBeGreaterThanOrEqual(.62-1e-9);
   expect(p.position.y+p.scale.y/2).toBeLessThanOrEqual(2.98+1e-9);
  }
 });
 it("retains unrelated structures and unrecognized panel groups",()=>{
  const source=buildWreckInterior(s);expect(build({...s,id:"crash-medbay"},source)).toEqual(source);
  const panels=source.filter(p=>p.finish==="panel");expect(build(s,panels)).toEqual(panels);
 });
});
