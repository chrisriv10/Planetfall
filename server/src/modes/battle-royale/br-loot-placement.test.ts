import {afterAll,describe,expect,it} from "vitest";
import type {Server,Socket} from "socket.io";
import {BR_LOOT_SOCKETS,BR_MAP_BLOCKS,type ClientToServerEvents,type ServerToClientEvents,type Vec3} from "@planetfall/shared";
import {BrPhysicsWorld} from "./br-physics.js";
import {BattleRoyaleRoom} from "./br-room.js";
import {generateBrLoot} from "./br-loot-generation.js";
import {placeBrLoot} from "./br-loot-placement.js";

const physics=new BrPhysicsWorld();
const ray=(origin:Vec3,direction:Vec3,maximum:number)=>physics.rayDistance(origin,direction,maximum);
afterAll(()=>physics.dispose());

describe("authoritative loot support",()=>{
 it("uses the actual roof slab top instead of the authored roof centre",()=>{
  const socket=BR_LOOT_SOCKETS.find(s=>s.kind==="roof")!;
  const roof=BR_MAP_BLOCKS.find(b=>b.id===`${socket.structureId}-roof`)!;
  expect(roof).toBeTruthy();
  const loot=generateBrLoot([socket],7,k=>k,(origin,requested)=>placeBrLoot(origin,requested,ray));
  expect(loot.length).toBeGreaterThan(0);
  for(const item of loot){
   expect(item.surfaceY).toBeCloseTo(roof.position.y+roof.size.y/2,4);
   expect(item.position.y).toBeCloseTo(item.surfaceY!+.58,4);
  }
 });

 it.each([7,901337,20260924])("keeps every generated pickup above real world collision (seed %s)",seed=>{
  let id=0;
  for(const item of generateBrLoot(BR_LOOT_SOCKETS,seed,k=>`${k}-${id++}`,(origin,requested)=>placeBrLoot(origin,requested,ray))){
   const distance=ray({...item.position,y:item.position.y+.01},{x:0,y:-1,z:0},512);
   expect(distance,item.id).toBeGreaterThanOrEqual(.5899);
   expect(distance,item.id).toBeLessThan(1.5);
  }
 });

 it.each(["coolant-frontage-office-interior","coolant-frontage-office-upper-loot"])("supports generated items and offset ammunition at %s",id=>{
  const socket=BR_LOOT_SOCKETS.find(s=>s.id===id)!;expect(socket).toBeTruthy();
  for(const item of generateBrLoot([socket],7,k=>k,(origin,requested)=>placeBrLoot(origin,requested,ray))){
   const distance=ray({...item.position,y:item.position.y+.01},{x:0,y:-1,z:0},2);
   expect(distance).toBeCloseTo(.59,3);
  }
 });

 it("resolves a forward drop uphill on the real internal incline",()=>{
  const origin={x:23.4,y:10,z:100};
  const floor=origin.y-ray(origin,{x:0,y:-1,z:0},20);
  const placed=placeBrLoot({...origin,y:floor+.615},{x:23.4,y:floor+.615,z:98.8},ray);
  const ahead=10-ray({x:placed.position.x,y:10,z:placed.position.z},{x:0,y:-1,z:0},20);
  expect(placed.surfaceY).toBeGreaterThan(floor+.1);
  expect(placed.surfaceY).toBeGreaterThanOrEqual(ahead);
  expect(placed.surfaceY-ahead).toBeLessThan(.5);
 });

 it("keeps the real room drop on the player's side of a wall and conserves the item",()=>{
  const io={to:()=>({emit:()=>{}})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const socket={id:"grounding",data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
  const room=new BattleRoyaleRoom("GROUND",io,7);
  try{
   const joined=room.join(socket,"Grounding");if(!joined.ok)throw new Error(joined.error);
   room.phase="combat";const player=room.players.get(joined.playerId)!;
   player.position={x:10,y:.395,z:98};player.yaw=-Math.PI/2;player.deployment="grounded";player.grounded=true;
   player.inventory[0]={instanceId:"test",itemId:"pulse-rifle",rarity:"rare",count:1,magazine:13};
   expect(room.drop(player.id,0)).toBe(true);
   expect(player.inventory[0]).toBeNull();expect(room.loot.size).toBe(1);
   const item=[...room.loot.values()][0];
   expect(item.position.x).toBeGreaterThan(8.4);expect(item.magazine).toBe(13);
   expect(item.surfaceY).toBeCloseTo(.36,4);
   expect(room.pickup(player.id,item.id)).toBe(true);
   expect(room.loot.size).toBe(0);expect(player.inventory[0]?.magazine).toBe(13);
  }finally{room.dispose();}
 });

 it("opens a real room crate with individually supported, recoverable incline drops",()=>{
  const io={to:()=>({emit:()=>{}})} as unknown as Server<ClientToServerEvents,ServerToClientEvents>;
  const socket={id:"crate-grounding",data:{},join:()=>{}} as unknown as Socket<ClientToServerEvents,ServerToClientEvents>;
  const room=new BattleRoyaleRoom("CRATE",io,7);
  try{
   const joined=room.join(socket,"Crate Grounding");if(!joined.ok)throw new Error(joined.error);
   room.phase="combat";const player=room.players.get(joined.playerId)!;
   const floor=10-ray({x:23.4,y:10,z:100},{x:0,y:-1,z:0},20);
   player.position={x:23.4,y:floor+.035,z:100};player.deployment="grounded";player.grounded=true;
   room.crates.set("incline-crate",{id:"incline-crate",position:{x:23.4,y:floor+.62,z:100},opened:false});
   expect(room.openCrate(player.id,"incline-crate")).toBe(true);
   const drops=[...room.loot.values()];expect(drops).toHaveLength(3);
   expect(new Set(drops.map(p=>p.surfaceY!.toFixed(3))).size).toBeGreaterThan(1);
   for(const placed of drops){
    expect(placed.position.y).toBeCloseTo(placed.surfaceY!+.58,4);
    const distance=ray({...placed.position,y:placed.position.y+.01},{x:0,y:-1,z:0},2);
    expect(distance).toBeGreaterThanOrEqual(.5899);expect(distance).toBeLessThan(1.1);
    expect(room.pickup(player.id,placed.id)).toBe(true);
   }
   expect(room.loot.size).toBe(0);
  }finally{room.dispose();}
 });
});

