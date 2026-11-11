import {describe,expect,it} from "vitest";
import {PG_BALANCE,PG_ZOMBIE_ARSENAL_SITE,PG_ZOMBIE_DOORS,PG_ZOMBIE_QUARANTINE_WINGS,PG_TACTICAL_MOVEMENT_RULES,pgCapsuleClear,pgSpawnMotion,type PgPlayer,type Vec3} from "@planetfall/shared";
import {pgStepMovement} from "@planetfall/shared";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
import {PgZombieEscort} from "./pg-zombie-escort.js";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";
import {pgCreateGun} from "@planetfall/shared";
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function fixture(origin:Vec3){
 const world=new PgModeWorld();world.reset([PG_ZOMBIE_ARSENAL_SITE.solid,...PG_ZOMBIE_DOORS.map(d=>d.solid),...PG_ZOMBIE_QUARANTINE_WINGS].map(solid=>({id:solid.id,solid,hp:1000000,maxHp:1000000,active:true,reinforced:true,revision:0})),0);
 const human={...pgSpawnMotion(origin),id:"human",team:"solar",hp:100,isBot:false} as PgPlayer;
 const bots=Array.from({length:3},(_,i)=>({...pgSpawnMotion(origin),id:`bot-${i}`,team:"solar",hp:100,isBot:true,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer));
 return {world,human,bots,nav:new PgZombieNavigation(world.map),escort:new PgZombieEscort()};
}
describe("survival escort spacing",()=>{
 it.each([{x:-20.041755,y:0,z:-3.589629},{x:0,y:0,z:24}])("separates three overlapping escorts near $x,$z using ordinary supported movement",origin=>{
  const {world,human,bots,nav,escort}=fixture(origin),memories=bots.map(()=>pgBotMemory());
  const goals=bots.map(bot=>escort.goal(bot,human,bots,world.map,nav)!);
  expect(goals.every(goal=>goal&&distance(goal,human.position)>=2.5&&distance(goal,human.position)<=4)).toBe(true);
  expect(new Set(goals.map(goal=>JSON.stringify(goal))).size).toBe(3);
  human.yaw=2.5;expect(bots.map(bot=>escort.goal(bot,human,bots,world.map,nav))).toEqual(goals);
  for(let tick=0;tick<60*20;tick++)for(let i=0;i<bots.length;i++){
   const bot=bots[i],goal=escort.goal(bot,human,bots,world.map,nav),steering=goal?nav.destination(bot.position,goal):null;
   const {input}=pgBotInput(bot,[human,...bots],tick*1000/60,"hard",memories[i],{map:world.map,goal,steering,grounded:true,visible:()=>true});
   expect(input.jump).toBe(false);pgStepMovement(bot,input,1/60,tick*1000/60,world.map,PG_TACTICAL_MOVEMENT_RULES);
   expect(pgCapsuleClear(bot.position,PG_BALANCE.height,world.map)).toBe(true);
  }
  for(let i=0;i<bots.length;i++){
   expect(distance(bots[i].position,human.position)).toBeGreaterThan(1.3);
   expect(distance(bots[i].position,goals[i])).toBeLessThan(.7);
   for(let j=0;j<i;j++)expect(distance(bots[i].position,bots[j].position)).toBeGreaterThan(1.3);
  }
 });
 it("refreshes slots after anchor movement and roster changes",()=>{
  const {world,human,bots,nav,escort}=fixture({x:0,y:0,z:24});const first=escort.goal(bots[0],human,bots,world.map,nav);
  human.position.x+=1;const moved=escort.goal(bots[0],human,bots,world.map,nav);expect(moved).not.toEqual(first);
  const roster=[bots[0],bots[2]];const goals=roster.map(bot=>escort.goal(bot,human,roster,world.map,nav)!);expect(distance(goals[0],goals[1])).toBeGreaterThan(2.4);
 });
 it("holds a supported current position when no slot exists and clears stale slots after topology replacement",()=>{
  const {world,human,bots,nav,escort}=fixture({x:0,y:0,z:24});expect(escort.goal(bots[0],human,bots,world.map,nav)).not.toBeNull();
  const map={...world.map,navigation:[],solids:[{id:"small-floor",kind:"floor" as const,center:{x:0,y:-.5,z:24},half:{x:.6,y:.5,z:.6},mantle:false}]};nav.update(map,100);
  bots[0].position.x=.1;expect(escort.goal(bots[0],human,bots,map,nav)).toEqual(bots[0].position);
  bots[0].position={...human.position};expect(escort.goal(bots[0],human,bots,map,nav)).toBeNull();
  const blocked={...map,solids:[...map.solids,{id:"blocked",kind:"structure" as const,center:{x:0,y:1,z:24},half:{x:1,y:1,z:1},mantle:false}]};nav.update(blocked,101);
  bots[0].position.x=.1;expect(escort.goal(bots[0],human,bots,blocked,nav)).toBeNull();
 });
});
