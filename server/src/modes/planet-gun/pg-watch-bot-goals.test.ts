import {describe,expect,it,vi} from "vitest";
import {PG_BALANCE,PG_HERO_IDS,PG_MAP,PG_OBJECTIVES,pgCapsuleClear,pgCreateGun,pgSpawnMotion,type PgPlayer,type PgSolid,type Vec3} from "@planetfall/shared";
import {PgWatch} from "./pg-watch.js";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";

function fixture(){
 const players=new Map<string,PgPlayer>();
 for(const [index,id] of PG_HERO_IDS.entries()){
  const position=PG_MAP.spawns[index].position;
  const p={...pgSpawnMotion(position,0),id,team:"solar",hp:100,lifeId:1,connected:true,isBot:true,crouched:false,grounded:true,slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],loadout:{primary:"pulse",secondary:"comet"},adsSince:0,fireReadyAt:0,protectedUntil:0,lastDamageAt:0,lastAttacker:null,respawnAt:0} as PgPlayer;
  players.set(id,p);
 }
 const world=new PgModeWorld(),mode=new PgWatch({players,world,respawn:p=>{p.hp=100;},damage:()=>0,finish:()=>{}});
 mode.start(10000);
 const round=(value:number)=>{(mode as unknown as {round:number}).round=value;};
 return {players,world,mode,round};
}
function assertGround(goal:Vec3|null,world:PgModeWorld,from:Vec3){
 expect(goal).not.toBeNull();
 expect(pgCapsuleClear(goal!,PG_BALANCE.height,world.map),JSON.stringify(goal)).toBe(true);
 const navigation=new PgZombieNavigation(world.map);
 expect(navigation.supported(goal!)).toBe(true);
 expect(navigation.reachable(from,goal!)).toBe(true);
}
function addCover(world:PgModeWorld,solid:PgSolid){
 expect(world.add({id:solid.id,solid,hp:200,maxHp:200,reinforced:false,active:true,revision:0},13000)).toBe(true);
}

describe("PlanetWatch physical bot goals",()=>{
 it("assigns all six heroes supported, reachable capture positions at every relay",()=>{
  const f=fixture();
  for(let round=1;round<=PG_OBJECTIVES.relay.length;round++){
   f.round(round);const point=PG_OBJECTIVES.relay[round-1];
   for(const p of f.players.values()){
    const goal=f.mode.botGoal(p,13000);
    assertGround(goal,f.world,p.position);
    expect(Math.hypot(goal!.x-point.position.x,goal!.y-point.position.y,goal!.z-point.position.z)).toBeLessThan(point.radius);
   }
  }
 });
 it("reselects goals after cover appears and restores preferred positions after destruction",()=>{
  const f=fixture();
  for(let round=1;round<=PG_OBJECTIVES.relay.length;round++){
   f.round(round);
   for(const p of f.players.values()){
    const preferred=f.mode.botGoal(p,13000)!,id=`goal-cover-${round}-${p.id}`;
    addCover(f.world,{id,kind:"structure",center:{...preferred,y:1.1},half:{x:.3,y:1.1,z:1.8},mantle:false});
    expect(pgCapsuleClear(preferred,PG_BALANCE.height,f.world.map)).toBe(false);
    const blocked=f.mode.botGoal(p,13001);
    expect(blocked).not.toEqual(preferred);assertGround(blocked,f.world,p.position);
    f.world.damage(id,200,13002);
    expect(f.mode.botGoal(p,13003)).toEqual(preferred);
   }
  }
 });
 it("does not assign a clear capture destination enclosed by dynamic walls",()=>{
  const f=fixture(),p=f.players.get("cairn")!;
  for(const [index,axis,sign] of [[0,"x",-1],[1,"x",1],[2,"z",-1],[3,"z",1]] as const){
   addCover(f.world,{id:`enclosure-${index}`,kind:"structure",center:{x:axis==="x"?sign*5:0,y:2,z:axis==="z"?sign*5:0},half:{x:axis==="x"?.2:5.2,y:2,z:axis==="z"?.2:5.2},mantle:false});
  }
  expect(pgCapsuleClear({x:2.2,y:0,z:0},PG_BALANCE.height,f.world.map)).toBe(true);
  expect(f.mode.botGoal(p,13001)).toBeNull();
 });
 it("keeps support goals grounded when a wounded ally is airborne",()=>{
  const f=fixture(),p=f.players.get("solace")!,ally=f.players.get("cairn")!;
  ally.hp=1;ally.position={x:0,y:3,z:0};
  const goal=f.mode.botGoal(p,13000);
  expect(goal).not.toEqual(ally.position);assertGround(goal,f.world,p.position);
  ally.position={x:0,y:0,z:0};
  expect(f.mode.botGoal(p,13170)).toEqual(ally.position);
 });
 it("bounds moving-origin reachability queries to the bot reaction interval and returns independent goals",()=>{
  const f=fixture(),p=f.players.get("cairn")!,query=vi.spyOn(PgZombieNavigation.prototype,"reachable");
  try{
   const first=f.mode.botGoal(p,13000)!,calls=query.mock.calls.length;
   expect(calls).toBeGreaterThan(0);
   for(let frame=1;frame<11;frame++){
    p.position={...p.position,x:p.position.x+.01};
    const next=f.mode.botGoal(p,13000+frame*1000/60)!;
    expect(next).toEqual(first);expect(next).not.toBe(first);
   }
   expect(query).toHaveBeenCalledTimes(calls);
   first.x=999;
   expect(f.mode.botGoal(p,13169)!.x).not.toBe(999);
   f.mode.botGoal(p,13170);expect(query.mock.calls.length).toBeGreaterThan(calls);
  }finally{query.mockRestore();}
 });
 it("invalidates cached choices immediately when relay or hero changes",()=>{
  const f=fixture(),p=f.players.get("cairn")!;
  const first=f.mode.botGoal(p,13000);
  f.round(2);const west=f.mode.botGoal(p,13001);
  expect(west).not.toEqual(first);
  p.isBot=false;
  expect(f.mode.action(p,{kind:"select",characterId:"kepler",sequence:1,lifeId:p.lifeId},13002).ok).toBe(true);
  expect(f.mode.botGoal(p,13002)).not.toEqual(west);
 });
});
