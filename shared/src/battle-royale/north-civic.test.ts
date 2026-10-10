import {describe,expect,it} from "vitest";
import {BR_STRUCTURES,BR_ROADS,BR_MAP_BLOCKS,BR_LOOT_SOCKETS,BR_NAV_NODES,BR_GREENWAY_TREES,brRoadIntersectsFootprint} from "./index.js";
const ids=["north-civic-archive","north-civic-exchange"];
describe("occupied North Civic approach",()=>{
 it("appends opposing enterable frontage with real walls, floors, stairs and loot",()=>{
  expect(BR_STRUCTURES.slice(187,189).map(s=>s.id)).toEqual(ids);
  for(const id of ids){
   const s=BR_STRUCTURES.find(s=>s.id===id)!;
   expect(s.enterable).toBe(true);expect(s.roofAccess).toBe(false);expect(s.position.y).toBe(0);
   expect(BR_MAP_BLOCKS.find(b=>b.id===`${id}-floor`)).toBeDefined();
   expect(BR_MAP_BLOCKS.filter(b=>b.id.startsWith(`${id}-`)&&b.kind==="wall").length).toBeGreaterThanOrEqual(5);
   expect(BR_LOOT_SOCKETS.filter(l=>l.structureId===id).length).toBeGreaterThanOrEqual(2);
   for(const road of BR_ROADS)expect(brRoadIntersectsFootprint(road,s.position,s.size,.5),`${id}/${road.id}`).toBe(false);
  }
  const archive=BR_STRUCTURES.find(s=>s.id===ids[0])!,exchange=BR_STRUCTURES.find(s=>s.id===ids[1])!;
  expect(archive.entrance).toBe("east");expect(exchange.entrance).toBe("west");expect(archive.floors).toBe(2);
  expect(BR_MAP_BLOCKS.find(b=>b.id===`${ids[0]}-stairs-1`)).toBeDefined();
  expect(BR_LOOT_SOCKETS.find(s=>s.id===`${ids[0]}-upper-loot`)).toBeDefined();
 });
 it("connects Zero's ground-level loop to the exact mall corner without altering its grade",()=>{
  const street=BR_ROADS.find(r=>r.id==="north-civic-street")!,link=BR_ROADS.find(r=>r.id==="north-civic-mall-link")!,arrival=BR_ROADS.find(r=>r.id==="north-civic-mall-arrival")!;
  const entry=BR_ROADS.find(r=>r.id==="north-civic-zero-entry")!,gardenLink=BR_ROADS.find(r=>r.id==="north-civic-garden-link")!;
  expect(entry.from).toEqual({x:-5,y:.1,z:58});expect(entry.to).toEqual(gardenLink.from);expect(gardenLink.to).toEqual(street.from);expect(street.to).toEqual(link.from);expect(link.to).toEqual(arrival.from);expect(arrival.to).toEqual({x:-5,y:.1,z:190});
  const origin=BR_NAV_NODES.find(n=>n.position.x===-5&&n.position.z===58)!;
  expect(origin.neighbors).toContain("road-70:0.1:58");
  const end=BR_NAV_NODES.find(n=>n.position.x===-5&&n.position.z===190)!;
  expect(end.neighbors).toContain("road--5:0.1:184");expect(end.neighbors).toContain("road--5:0.1:345");
  const grade=BR_ROADS.find(r=>r.id==="mall-circulation-s-grade-part-2")!;
  expect(grade.from).toEqual({x:-145,y:1.9666666666666666,z:190});expect(grade.to).toEqual(arrival.to);
 });
 it("retains all garden trees and keeps the literal rest pocket outside the new lane",()=>{
  expect(BR_GREENWAY_TREES).toHaveLength(66);
  expect(BR_GREENWAY_TREES.filter(t=>t.band==="central-garden").map(t=>t.id)).toEqual([0,1,2,3,4,5,6].map(i=>`greenway-central-garden-${i}`));
  for(const road of BR_ROADS.filter(r=>r.id.startsWith("north-civic-"))){
   expect(brRoadIntersectsFootprint(road,{x:-25,y:0,z:125},{x:4,y:2,z:3},.5)).toBe(false);
   for(const block of BR_MAP_BLOCKS.filter(b=>b.kind==="cover"||b.id.endsWith("-trunk")))expect(brRoadIntersectsFootprint(road,block.position,block.size,.5),block.id).toBe(false);
  }
 });
});
