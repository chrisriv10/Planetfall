import {describe,expect,it} from "vitest";
import {PR_BALANCE} from "./balance.js";
import {buildShatterdeckLayout,SHATTERDECK_LAYOUT_CONFIG} from "./shatterdeck-layout.js";
import type {PrTile} from "./types.js";

const radius=(q:number,s:number)=>Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s));
const coordinates=(tile:PrTile)=>`${tile.deck}:${tile.column}:${tile.row}`;
function components(tiles:readonly PrTile[]):number[]{
 const remaining=new Set(tiles.map(tile=>tile.id)),byId=new Map(tiles.map(tile=>[tile.id,tile]));
 const sizes:number[]=[];
 while(remaining.size){
  const pending=[remaining.values().next().value!];remaining.delete(pending[0]);let size=0;
  while(pending.length){const id=pending.pop()!;size++;for(const neighbor of byId.get(id)!.neighbors)if(remaining.delete(neighbor))pending.push(neighbor);}
  sizes.push(size);
 }
 return sizes.sort((a,b)=>b-a);
}

describe("authored enlarged Shatterdeck layout",()=>{
 it("has four bounded larger footprints and exact authored counts",()=>{
  const {tiles,killY}=buildShatterdeckLayout();
  expect(tiles).toHaveLength(693);expect(tiles.length).toBeLessThanOrEqual(750);
  expect([0,1,2,3].map(deck=>tiles.filter(tile=>tile.deck===deck).length)).toEqual([91,204,183,215]);
  expect(SHATTERDECK_LAYOUT_CONFIG.hexLimits).toEqual([5,8,8,9]);
  expect(SHATTERDECK_LAYOUT_CONFIG.tileRadius).toBe(PR_BALANCE.tileRadius);expect(PR_BALANCE.tileRadius).toBe(1.35);
  expect(killY).toBe(-6.5);
  for(const [deck,oldLimit]of [4,6,6,7].entries()){
   const layer=tiles.filter(tile=>tile.deck===deck);
   expect(Math.max(...layer.map(tile=>radius(tile.column,tile.row)))).toBeGreaterThan(oldLimit);
   const oldArea=layer.filter(tile=>radius(tile.column,tile.row)<=oldLimit).length;
   expect(layer.length).toBeGreaterThan(oldArea);
  }
 });
 it("preserves all four authored shapes, including holes, slots and wing links",()=>{
  const {tiles}=buildShatterdeckLayout(),lookup=new Set(tiles.map(coordinates));
  for(let deck=0;deck<4;deck++)for(let q=-9;q<=9;q++)for(let s=-9;s<=9;s++){
   const distance=radius(q,s),inside=distance<=([5,8,8,9][deck]);
   const hole=deck===1&&(distance<2||q>2&&s===0)||deck===2&&Math.abs(q)<2&&Math.abs(s)>2||deck===3&&distance>3&&(q-s)%4===0;
   expect(lookup.has(`${deck}:${q}:${s}`),`deck ${deck}, axial ${q},${s}`).toBe(inside&&!hole);
  }
  expect(lookup.has("1:0:0")).toBe(false);expect(lookup.has("1:2:0")).toBe(true);expect(lookup.has("1:8:0")).toBe(false);
  expect(lookup.has("2:0:2")).toBe(true);expect(lookup.has("2:0:3")).toBe(false);expect(lookup.has("2:2:3")).toBe(true);
  expect(lookup.has("3:0:0")).toBe(true);expect(lookup.has("3:4:0")).toBe(false);expect(lookup.has("3:5:0")).toBe(true);
 });
 it("uses canonical hex centers and 7.5m vertical clearance between successive decks",()=>{
  const {tiles,killY}=buildShatterdeckLayout(),heights=[26,18.5,11,3.5];
  expect([...new Set(tiles.map(tile=>tile.center.y))]).toEqual(heights);
  for(let index=1;index<heights.length;index++)expect(heights[index-1]-heights[index]).toBe(7.5);
  expect(heights.at(-1)!-killY).toBe(10);
  for(const tile of tiles){
   expect(tile.center.x).toBeCloseTo(Math.sqrt(3)*1.35*(tile.column+tile.row/2),10);
   expect(tile.center.z).toBeCloseTo(1.5*1.35*tile.row,10);expect(tile.center.y).toBe(heights[tile.deck]);
  }
 });
 it("provides dense unique IDs and exact reciprocal same-height axial adjacency",()=>{
  const {tiles}=buildShatterdeckLayout(),lookup=new Map(tiles.map(tile=>[coordinates(tile),tile]));
  expect(new Set(tiles.map(coordinates)).size).toBe(tiles.length);expect(tiles.map(tile=>tile.id)).toEqual(tiles.map((_,index)=>index));
  const offsets=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  for(const tile of tiles){
   const expected=offsets.map(([q,s])=>lookup.get(`${tile.deck}:${tile.column+q}:${tile.row+s}`)?.id).filter(id=>id!==undefined);
   expect(tile.neighbors).toEqual(expected);expect(new Set(tile.neighbors).size).toBe(tile.neighbors.length);expect(tile.neighbors.length).toBeLessThanOrEqual(6);
   for(const id of tile.neighbors){const neighbor=tiles[id];expect(neighbor.deck).toBe(tile.deck);expect(neighbor.center.y).toBe(tile.center.y);expect(neighbor.neighbors).toContain(tile.id);expect(Math.hypot(tile.center.x-neighbor.center.x,tile.center.z-neighbor.center.z)).toBeCloseTo(Math.sqrt(3)*PR_BALANCE.tileRadius,9);}
  }
 });
 it("keeps each authored footprint traversably connected despite its intentional voids",()=>{
  const {tiles}=buildShatterdeckLayout();
  for(const deck of [0,1,2,3]){const layer=tiles.filter(tile=>tile.deck===deck);expect(components(layer)).toEqual([layer.length]);}
  // Four disjoint vertical layers; no cross-deck edge pretends a drop is walkable.
  expect(components(tiles)).toHaveLength(4);
 });
 it("distributes 30 unique supported capsule-separated spawns inside a full tile edge buffer",()=>{
  const {tiles,spawns}=buildShatterdeckLayout();expect(spawns).toHaveLength(30);
  expect(new Set(spawns.map(point=>`${point.x}:${point.y}:${point.z}`)).size).toBe(30);expect(spawns[0]).toEqual({x:0,y:26,z:0});
  const supports=spawns.map(point=>tiles.find(tile=>tile.deck===0&&tile.center.x===point.x&&tile.center.y===point.y&&tile.center.z===point.z));
  for(const support of supports){expect(support).toBeDefined();expect(radius(support!.column,support!.row)).toBeLessThanOrEqual(4);expect(support!.neighbors).toHaveLength(6);}
  for(let a=0;a<spawns.length;a++)for(let b=a+1;b<spawns.length;b++)expect(Math.hypot(spawns[a].x-spawns[b].x,spawns[a].z-spawns[b].z)).toBeGreaterThanOrEqual(PR_BALANCE.radius*2);
  // Selection must populate the buffered crown rather than cluster at one corner.
  expect(spawns.some(point=>point.x>6)).toBe(true);expect(spawns.some(point=>point.x< -6)).toBe(true);expect(spawns.some(point=>point.z>6)).toBe(true);expect(spawns.some(point=>point.z< -6)).toBe(true);
 });
 it("is deterministic and returns independently mutable round state",()=>{
  const first=buildShatterdeckLayout(),second=buildShatterdeckLayout();expect(first).toEqual(second);
  first.tiles[0].center.x=123;first.tiles[0].neighbors.length=0;first.spawns[0].x=321;
  expect(second).toEqual(buildShatterdeckLayout());expect(first.spawns[0]).not.toBe(first.tiles.find(tile=>tile.column===0&&tile.row===0&&tile.deck===0)!.center);
 });
});
