import {describe,expect,it} from "vitest";
import {PG_MAP,pgCreateGun,pgSpawnMotion,type PgPlayer} from "@planetfall/shared";
import {pgBotAware} from "./pg-bot-perception.js";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";

const pilot=(id:string,x=0,z=0)=>({...pgSpawnMotion({x,y:0,z}),id,team:id==="bot"?"solar":"void",hp:100,lastDamageAt:0,lastAttacker:null,grounded:true,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer);
describe("bounded bot awareness",()=>{
 it("sees the forward cone and periphery without acquiring a quiet enemy behind",()=>{
  const bot=pilot("bot"),target=pilot("target",0,-20);
  expect(pgBotAware(bot,target,1000)).toBe(true);
  target.position={x:20*Math.sin(69*Math.PI/180),y:0,z:-20*Math.cos(69*Math.PI/180)};
  expect(pgBotAware(bot,target,1000)).toBe(true);
  target.position.z=20;expect(pgBotAware(bot,target,1000)).toBe(false);
  bot.yaw=Math.PI;target.position.x=0;expect(pgBotAware(bot,target,1000)).toBe(true);
 });
 it("hears nearby moving opponents but preserves quiet and crouched flanks",()=>{
  const bot=pilot("bot"),target=pilot("target",0,5);
  expect(pgBotAware(bot,target,1000)).toBe(false);
  target.velocity.x=3;expect(pgBotAware(bot,target,1000)).toBe(true);
  target.crouched=true;expect(pgBotAware(bot,target,1000)).toBe(false);
  target.crouched=false;target.position.z=6.1;expect(pgBotAware(bot,target,1000)).toBe(false);
 });
 it("reacts only to the actual recent attacker and never to a future timestamp",()=>{
  const bot=pilot("bot"),target=pilot("target",0,20);bot.lastAttacker=target.id;bot.lastDamageAt=1000;
  expect(pgBotAware(bot,target,999)).toBe(false);
  expect(pgBotAware(bot,target,1000)).toBe(true);expect(pgBotAware(bot,target,2500)).toBe(true);
  expect(pgBotAware(bot,target,2501)).toBe(false);
  bot.lastAttacker="other";expect(pgBotAware(bot,target,1100)).toBe(false);
 });
 it("never treats sound or recent damage as permission to track through a wall",()=>{
  const bot=pilot("bot"),target=pilot("target",0,5),memory=pgBotMemory();bot.lastAttacker=target.id;bot.lastDamageAt=1000;target.velocity.x=3;
  const decision=pgBotInput(bot,[bot,target],1100,"normal",memory,{map:PG_MAP,goal:null,steering:null,visible:()=>false});
  expect(memory.targetId).toBeNull();expect(memory.aim!.sample).toBeNull();expect(decision.fire).toBe(false);
 });
 it("does not acquire a visible rear target until the pilot actually turns",()=>{
  const bot=pilot("bot"),target=pilot("target",0,20),memory=pgBotMemory(),ctx={map:PG_MAP,goal:null,steering:null,visible:()=>true};
  expect(pgBotInput(bot,[bot,target],1000,"hard",memory,ctx).fire).toBe(false);expect(memory.targetId).toBeNull();
  bot.yaw=Math.PI;pgBotInput(bot,[bot,target],1100,"hard",memory,ctx);expect(memory.targetId).toBe(target.id);expect(memory.fireAt).toBe(1270);
 });
});
