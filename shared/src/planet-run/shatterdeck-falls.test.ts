import {describe,expect,it} from "vitest";
import {PR_BALANCE,PrTileState,prRound,prSpawn,prStepMotion} from "./index.js";

const idle={sequence:0,moveX:0,moveZ:0,jump:false,dive:false};
describe("canonical enlarged Shatterdeck support",()=>{
 it("starts all 30 authored pilots on distinct supported upper tiles",()=>{
  const round=prRound("shatterdeck"),state=new PrTileState(round.tiles),supports=new Set<string>();
  expect(round.tiles).toHaveLength(693);expect(round.spawns).toHaveLength(30);
  for(const spawn of round.spawns){const pilot=prSpawn(spawn);prStepMotion(pilot,idle,1/PR_BALANCE.tickRate,0,round,42,state);expect(pilot.grounded).toBe(true);expect(pilot.position.y).toBe(26);expect(pilot.supportId).toMatch(/^tile:/);supports.add(pilot.supportId!);}
  expect(supports.size).toBe(30);
 });
 it.each([0,1,2])("lands on the next intact deck after a full 7.5m drop from deck %i",deck=>{
  const round=prRound("shatterdeck"),state=new PrTileState(round.tiles);
  const upper=round.tiles.find(tile=>tile.deck===deck&&tile.column===2&&tile.row===1)!,lower=round.tiles.find(tile=>tile.deck===deck+1&&tile.column===2&&tile.row===1)!;
  expect(upper.center.y-lower.center.y).toBe(7.5);
  for(const tile of round.tiles)if(tile.deck<=deck)state.contact(tile.id,0);
  const pilot=prSpawn({...upper.center,y:upper.center.y+.1});pilot.velocity.y=-1;
  let airborne=0;for(let step=0;step<90&&!pilot.grounded;step++){prStepMotion(pilot,idle,1/30,1000+step*1000/30,round,42,state);airborne++;}
  expect(airborne).toBeGreaterThan(10);expect(pilot.grounded).toBe(true);expect(pilot.position.y).toBe(lower.center.y);expect(pilot.supportId).toBe(`tile:${lower.id}`);expect(pilot.velocity.y).toBe(0);
 });
 it("removes expired upper support exactly once and falls past a completely missing intermediate deck",()=>{
  const round=prRound("shatterdeck"),state=new PrTileState(round.tiles),top=round.tiles.find(tile=>tile.deck===0&&tile.column===2&&tile.row===1)!,landing=round.tiles.find(tile=>tile.deck===2&&tile.column===2&&tile.row===1)!;
  const pilot=prSpawn(top.center);prStepMotion(pilot,idle,1/30,100,round,42,state);expect(pilot.grounded).toBe(true);
  state.contact(top.id,100);for(const tile of round.tiles)if(tile.deck===1)state.contact(tile.id,0);
  expect(state.contact(top.id,600)).toBeNull();prStepMotion(pilot,idle,1/30,719,round,42,state);expect(pilot.grounded).toBe(true);
  prStepMotion(pilot,idle,1/30,720,round,42,state);expect(pilot.grounded).toBe(false);expect(pilot.position.y).toBeLessThan(26);
  for(let step=1;step<90&&!pilot.grounded;step++)prStepMotion(pilot,idle,1/30,720+step*1000/30,round,42,state);
  expect(pilot.supportId).toBe(`tile:${landing.id}`);expect(pilot.position.y).toBe(11);expect(pilot.grounded).toBe(true);
 });
 it("falls through the kill plane after the bottom support disappears",()=>{
  const round=prRound("shatterdeck"),state=new PrTileState(round.tiles),bottom=round.tiles.find(tile=>tile.deck===3&&tile.column===2&&tile.row===1)!;
  const pilot=prSpawn(bottom.center);prStepMotion(pilot,idle,1/30,100,round,42,state);state.contact(bottom.id,100);
  for(let step=0;step<90&&pilot.position.y>=round.killY;step++)prStepMotion(pilot,idle,1/30,720+step*1000/30,round,42,state);
  expect(round.killY).toBe(-6.5);expect(pilot.position.y).toBeLessThan(round.killY);expect(pilot.supportId).toBeNull();expect(pilot.grounded).toBe(false);
 });
});
