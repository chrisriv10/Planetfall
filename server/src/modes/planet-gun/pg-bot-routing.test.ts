import {describe,expect,it} from "vitest";
import {PG_MAP,PG_OBJECTIVES,PG_TACTICAL_MOVEMENT_RULES,pgCollisionMap,pgCreateCollisionSnapshot,pgCreateGun,pgRayBox,pgSpawnMotion,pgStepMovement,type PgMap,type PgPlayer,type Vec3} from "@planetfall/shared";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";
import {PgStrike} from "./pg-strike.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";

const player=(position:Vec3,team:PgPlayer["team"]="solar")=>({...pgSpawnMotion(position),id:`routing-${team}`,team,hp:100,grounded:true,lifeId:1,connected:true,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer);
const context=(goal:Vec3,map=PG_MAP)=>({map,goal,grounded:true,visible:()=>false});
const point=(x:number,z:number):Vec3=>({x,y:0,z});
const corners=[
 {name:"solar A south entrance",position:point(-27.8,0),anchor:21,site:0},
 {name:"void A interior partition",position:point(-20.2,-12.2),anchor:19,site:0},
 {name:"solar B west entrance",position:point(12.2,16),anchor:99,site:1},
 {name:"void B service wing",position:point(36.2,-3.8),anchor:84,site:1},
];

describe("objective bot route following",()=>{
 it.each([
  {name:"recent incoming fire",damageAt:900,attacker:"enemy",range:40,respond:true},
  {name:"expired incoming fire",damageAt:-1000,attacker:"enemy",range:40,respond:false},
  {name:"fresh spawn timestamp without damage",damageAt:900,attacker:null,range:40,respond:false},
  {name:"enemy outside current weapon range",damageAt:900,attacker:"enemy",range:100,respond:false},
 ])("handles $name without changing aim reaction or ordinary approach speed",({damageAt,attacker,range,respond})=>{
  const p={...player(point(-40,0)),yaw:-Math.PI/2,lastDamageAt:damageAt,lastAttacker:attacker,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer;
  const enemy={...player(point(-40+range,0),"void"),id:"enemy"},memory=pgBotMemory(),ctx={...context(PG_OBJECTIVES.strike[1].position),visible:()=>true};
  const first=pgBotInput(p,[p,enemy],1000,"normal",memory,ctx);
  expect(first.input.sprint).toBe(!respond);expect(first.input.ads).toBe(respond);
  expect(first.fire).toBe(false);expect(memory.fireAt).toBe(1300);
  const ready=pgBotInput(p,[p,enemy],1301,"normal",memory,ctx);
  expect(ready.fire).toBe(respond);
 });

 it.each([true,false])("finds the nearest visible live enemy and stops visibility checks there (nearest visible: %s)",nearestVisible=>{
  const p=player(point(40,0)),memory=pgBotMemory(),seen:number[]=[];p.yaw=Math.PI/2;
  const near={...player(point(35,0),"void"),id:"near"},far={...player(point(30,0),"void"),id:"far"},last={...player(point(20,0),"void"),id:"last"};
  const dead={...player(point(39,0),"void"),id:"dead",hp:0},ally={...player(point(38,0)),id:"ally"};
  pgBotInput(p,[last,p,dead,far,ally,near],1000,"normal",memory,{...context(point(40,4)),visible:(_from,to)=>{seen.push(to.x);return nearestVisible||to.x<=30;}});
  expect(memory.targetId).toBe(nearestVisible?"near":"far");
  expect(seen).toEqual(nearestVisible?[35]:[35,30]);
  expect(memory.fireAt).toBe(1300);
 });

 it.each(corners)("retains the safe connector at $name across reaction replans",({position,anchor,site})=>{
  const p=player(position),memory=pgBotMemory(),goal=PG_OBJECTIVES.strike[site].position;
  pgBotInput(p,[p],1000,"normal",memory,context(goal));
  expect(memory.path[0]).toBe(anchor);
  const path=[...memory.path];
  pgBotInput(p,[p],1350,"normal",memory,context(goal));
  expect(memory.path).toEqual(path);
 });

 it("does not cut a blocked corner merely because its anchor is within the arrival radius",()=>{
  const p=player(point(-24.8,0)),memory=pgBotMemory(),goal=PG_OBJECTIVES.strike[0].position;
  // The anchor connector is clear, but west-south panel closes its successor.
  const panel={id:"test-door",kind:"structure" as const,center:{x:-24,y:1.4,z:-1},half:{x:2,y:1.4,z:.18},mantle:false};
  const map={...PG_MAP,solids:[...PG_MAP.solids,panel]};
  memory.path=[21,20];memory.routeMap=map;memory.routeGoal={...goal};memory.nextDecision=Infinity;
  pgBotInput(p,[p],1000,"normal",memory,context(goal,map));
  expect(memory.path[0]).toBe(21);
 });

 it("rebuilds retained routes when the goal or collision topology changes",()=>{
  const p=player(point(-40,-27)),memory=pgBotMemory(),a=PG_OBJECTIVES.strike[0].position,b=PG_OBJECTIVES.strike[1].position;
  pgBotInput(p,[p],1000,"normal",memory,context(a));
  const firstGoal=memory.goal;
  pgBotInput(p,[p],1010,"normal",memory,context(b));
  expect(memory.goal).not.toBe(firstGoal);expect(memory.routeGoal).toEqual(b);
  const map={...PG_MAP,navigation:PG_MAP.navigation.map(n=>({...n,links:[]}))};
  pgBotInput(p,[p],1020,"normal",memory,context(b,map));
  expect(memory.routeMap).toBe(map);expect(memory.path.length).toBeLessThanOrEqual(1);
 });

 it("holds instead of driving directly through a blocker when the graph has no route",()=>{
  const p=player(point(-40,0)),memory=pgBotMemory(),goal=point(-24,-8);
  const map:PgMap={...PG_MAP,navigation:[{id:0,position:{...p.position},links:[]},{id:1,position:goal,links:[]}]};
  const {input}=pgBotInput(p,[p],1000,"normal",memory,context(goal,map));
  expect(memory.path).toEqual([0]);expect(Math.hypot(input.moveX,input.moveZ)).toBe(0);
 });

 it("physically walks outward from a wall contact inside only the navigation safety skin",()=>{
  const obstacle={id:"contact-wall",kind:"structure" as const,center:{x:0,y:1,z:0},half:{x:1,y:1,z:1},mantle:false};
  const goal=point(3,0),map:PgMap={...PG_MAP,solids:[PG_MAP.solids[0],obstacle],navigation:[{id:0,position:goal,links:[]}]};
  const p=player(point(1.42,0)),memory=pgBotMemory();
  for(let tick=0;tick<120;tick++){
   const now=1000+tick*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory,context(goal,map));
   pgStepMovement(p,input,1/60,now,map,PG_TACTICAL_MOVEMENT_RULES);
   expect(p.position.x).toBeGreaterThanOrEqual(1.42);
  }
  expect(p.position.x).toBeGreaterThan(2.9);
 });

 it.each(["feet","head","through-wall"])("rejects safety-skin egress when the swept body intersects %s geometry",kind=>{
  const obstacle={id:"contact-wall",kind:"structure" as const,center:{x:0,y:1,z:0},half:{x:1,y:1,z:1},mantle:false};
  const goal=point(kind==="through-wall"?-3:3,0);
  const extra=kind==="through-wall"?[]:[{id:"swept-blocker",kind:"structure" as const,center:{x:2.25,y:kind==="feet"?.15:1.7,z:0},half:{x:.1,y:.15,z:.5},mantle:false}];
  const map:PgMap={...PG_MAP,solids:[PG_MAP.solids[0],obstacle,...extra],navigation:[{id:0,position:goal,links:[]}]};
  const p=player(point(1.42,0)),memory=pgBotMemory(),{input}=pgBotInput(p,[p],1000,"normal",memory,context(goal,map));
  expect(memory.routeBlocked).toBe(true);expect(memory.path).toEqual([]);
  expect(Math.hypot(input.moveX,input.moveZ)).toBe(0);
 });

 it.each(PG_MAP.spawns.flatMap(spawn=>PG_OBJECTIVES.strike.map(site=>({spawn,site}))))("walks naturally from $spawn.id into site $site.id",({spawn,site})=>{
  const p=player(spawn.position,spawn.team),memory=pgBotMemory();
  let arrived=false;
  for(let tick=0;tick<60*60;tick++){
   const now=1000+tick*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory,context(site.position));
   pgStepMovement(p,input,1/60,now,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);
   const dx=site.position.x-p.position.x,dz=site.position.z-p.position.z,d=Math.hypot(dx,dz),eye={...p.position,y:p.position.y+1};
   const clear=d<.01||!PG_MAP.solids.some(s=>{const t=pgRayBox(eye,{x:dx/d,y:0,z:dz/d},s);return t!==null&&t<d;});
   if(Math.hypot(dx,p.position.y-site.position.y,dz)<=site.radius&&clear){arrived=true;break;}
  }
  expect(arrived,`${spawn.id} -> ${site.id}, stopped at ${JSON.stringify(p.position)}, path ${memory.path}`).toBe(true);
 });

 it("physically takes a short local bypass around paired deployed spawn cover",()=>{
  const snapshot=pgCreateCollisionSnapshot(false);
  for(const [id,x,z]of [["cover-11",-40.0714917819,-25.8369091252],["cover-17",-40.0001395612,-25.0206248975]]as const)snapshot.panels.push({id,solid:{id:`solid-${id}`,kind:"utility",center:{x,y:.5,z},half:{x:1,y:.5,z:.175},mantle:false},hp:100,maxHp:100,active:true,reinforced:false,revision:0});
  const map=pgCollisionMap(snapshot),p=player(point(-40,-32)),memory=pgBotMemory(),goal=point(-36.2,-11);let traveled=0,arrived=false;
  for(let tick=0;tick<60*30;tick++){
   const before={...p.position},now=1000+tick*1000/60,{input}=pgBotInput(p,[p],now,"normal",memory,context(goal,map));
   pgStepMovement(p,input,1/60,now,map,PG_TACTICAL_MOVEMENT_RULES);traveled+=Math.hypot(p.position.x-before.x,p.position.z-before.z);
   if(Math.hypot(p.position.x-goal.x,p.position.z-goal.z)<.65){arrived=true;break;}
  }
  expect(arrived,`stalled at ${JSON.stringify(p.position)} with route ${memory.path}`).toBe(true);
  expect(traveled).toBeLessThan(32);expect(p.position.y).toBe(0);
 });

 it("invalidates removed bypass waypoints even when the mode clears its objective before a reaction tick",()=>{
  const snapshot=pgCreateCollisionSnapshot(false);snapshot.panels.push({id:"cover-expiry",solid:{id:"cover-expiry-solid",kind:"utility",center:{x:-40,y:.5,z:-25},half:{x:1,y:.5,z:.175},mantle:false},hp:100,maxHp:100,active:true,reinforced:false,revision:0});
  const oldMap=pgCollisionMap(snapshot),newMap=pgCollisionMap(pgCreateCollisionSnapshot(false)),corner=oldMap.navigation.at(-1)!;
  expect(corner.id).toBeGreaterThanOrEqual(newMap.navigation.length);
  const p=player(point(-40,-32)),memory=pgBotMemory();Object.assign(memory,{path:[corner.id],goal:corner.id,routeMap:oldMap,routeGoal:{...corner.position},nextDecision:Infinity});
  const result=pgBotInput(p,[p],1000,"normal",memory,{map:newMap,goal:null,grounded:true,visible:()=>false});
  expect(memory.routeMap).toBe(newMap);expect(memory.path.every(id=>!!newMap.navigation[id])).toBe(true);expect([result.input.moveX,result.input.moveZ,result.input.yaw,result.input.pitch].every(Number.isFinite)).toBe(true);
 });

 it("keeps buy goals at each bot's closest valid team purchase spawn",()=>{
  const players=new Map<string,PgPlayer>();
  for(const spawn of PG_MAP.spawns){const p={...player(spawn.position,spawn.team),id:spawn.id};players.set(p.id,p);}
  const ctx={players,world:new PgModeWorld(),finish(){},respawn(){},damage(){return 0;}} as unknown as PgModeContext;
  const mode=new PgStrike(ctx);mode.start(0);
  for(const p of players.values())expect(mode.botGoal(p,100)).toEqual(PG_MAP.spawns.find(s=>s.id===p.id)!.position);
 });

 it("walks from its real spawn, brakes inside the site, and completes an ordinary stationary plant",()=>{
  const a=player(PG_MAP.spawns[0].position),b={...player(PG_MAP.spawns.find(s=>s.team==="void")!.position,"void"),id:"defender"};
  const players=new Map([[a.id,a],[b.id,b]]),world=new PgModeWorld();
  const ctx={players,world,finish(){},respawn(){},damage(){return 0;}} as unknown as PgModeContext;
  const mode=new PgStrike(ctx),memory=pgBotMemory();mode.start(0);
  let planted=false;
  for(let tick=0;tick<60*60;tick++){
   const now=tick*1000/60;mode.botAction(a,now);
   const goal=mode.botGoal(a,now),{input}=pgBotInput(a,[a],now,"normal",memory,{map:world.map,goal,grounded:true,visible:()=>false});
   pgStepMovement(a,input,1/60,now,world.map,PG_TACTICAL_MOVEMENT_RULES);mode.update(1/60,now);
   if(mode.snapshot().charge.site){planted=true;break;}
  }
  expect(planted).toBe(true);
 });
});
