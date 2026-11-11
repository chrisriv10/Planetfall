import {describe,expect,it} from "vitest";
import {PG_MAP,pgCapsuleClear,pgCreateGun,pgRayBox,pgSpawnMotion,type PgPlayer,type Vec3} from "@planetfall/shared";
import {PgSiege} from "./pg-siege.js";
import {PgModeWorld} from "./pg-mode-world.js";
import {PgZombieNavigation} from "./pg-zombie-navigation.js";
import type {PgModeContext} from "./pg-mode-runtime.js";

function fixture(){
 const players=new Map<string,PgPlayer>(),world=new PgModeWorld();
 for(const team of ["solar","void"] as const)for(let i=0;i<6;i++){
  const id=team+"-"+i;players.set(id,{...pgSpawnMotion(PG_MAP.spawns.find(s=>s.team===team)!.position),id,team,isBot:true,lifeId:0,hp:100,lastDamageAt:-1000,protectedUntil:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0} as PgPlayer);
 }
 let mode:PgSiege;
 const context:PgModeContext={players,world,finish(){},damage(){return 0;},respawn(p,now,loadout,position){Object.assign(p,pgSpawnMotion(position??PG_MAP.spawns.find(s=>s.team===p.team)!.position));p.lifeId++;p.hp=100;p.protectedUntil=now;p.guns=[pgCreateGun(loadout?.primary??"pulse"),pgCreateGun(loadout?.secondary??"orbit")];}};
 mode=new PgSiege(context);mode.start(0);mode.update(0,35000);
 for(const player of players.values())player.position={...PG_MAP.spawns.find(s=>s.team===player.team)!.position};
 return {players,world,mode};
}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

describe("Siege safe approach cover",()=>{
 it("uses an independently audited lateral placement when direct cover cuts a friendly route",()=>{
  const {players,world,mode}=fixture(),operator=players.get("solar-3")!,enemy=players.get("void-0")!;
  operator.position={x:-41,y:0,z:-20};enemy.position={x:-35.34314575050762,y:0,z:-25.65685424949238};
  const direct={x:-39.16152236891497,y:0,z:-21.838477631085023},side={x:-38.030151519016506,y:0,z:-19.85857864376269};
  const navigation=new PgZombieNavigation(world.map),paths:{from:Vec3;path:Vec3[]}[]=[];
  for(const ally of players.values())if(ally.team===operator.team){
   const goal=mode.botGoal(ally,35010);mode.botWaypoint(ally,goal);
   const cache=(mode as unknown as {botSteering:Map<string,{path:Vec3[]}>}).botSteering;
   paths.push({from:ally.position,path:cache.get(ally.id)?.path??(goal?[goal]:[])});
  }
  const solid=(at:Vec3,expanded:boolean)=>({id:"audited-cover",kind:"structure" as const,center:{...at,y:.5},half:expanded?{x:1.43,y:.5,z:.605}:{x:1,y:.5,z:.175},mantle:true});
  const cutsRoute=(at:Vec3)=>paths.some(route=>{
   let from=route.from;for(const next of route.path){
    const length=distance(from,next);if(length>.01){const hit=pgRayBox({...from,y:.5},{x:(next.x-from.x)/length,y:0,z:(next.z-from.z)/length},solid(at,true));if(hit!==null&&hit<=length)return true;}from=next;
   }return false;
  });
  expect(mode.snapshot(operator.id).pilots[operator.id].characterId).toBe("strut");
  expect(world.visible({...operator.position,y:1.3},{...enemy.position,y:1.3})).toBe(true);
  expect(cutsRoute(direct)).toBe(true);expect(cutsRoute(side)).toBe(false);
  expect(distance(operator.position,side)).toBeLessThan(3);expect(navigation.supported(side)).toBe(true);
  expect(pgCapsuleClear(side,.6,world.map)).toBe(true);
  for(const x of [-.9,0,.9])for(const z of [-.175,.175])expect(pgCapsuleClear({x:side.x+x,y:0,z:side.z+z},.6,world.map)).toBe(true);
  for(const ally of players.values())expect(distance(ally.position,side)).toBeGreaterThan(1.6);
  // A route connector may span this location without a redundant waypoint.
  const protectedPoint={x:-40,y:0,z:-16};expect(paths.some(route=>{
   let from=route.from;for(const next of route.path){
    if(Math.abs(distance(from,protectedPoint)+distance(protectedPoint,next)-distance(from,next))<.001)return true;
    from=next;
   }return false;
  })).toBe(true);
  const length=distance(protectedPoint,enemy.position),ray={x:(enemy.position.x-protectedPoint.x)/length,y:0,z:(enemy.position.z-protectedPoint.z)/length};
  expect(world.visible({...protectedPoint,y:.5},{...enemy.position,y:.5})).toBe(true);
  const interception=pgRayBox({...protectedPoint,y:.5},ray,solid(side,false));expect(interception).not.toBeNull();expect(interception!).toBeLessThan(length);
  mode.botAction(operator,35010);
  const panels=world.snapshot().panels.filter(panel=>panel.id.startsWith("cover-"));expect(panels).toHaveLength(1);
  expect(panels[0].hp).toBe(300);expect(panels[0].solid.center.x).toBeCloseTo(side.x);expect(panels[0].solid.center.z).toBeCloseTo(side.z);
  expect(mode.snapshot(operator.id).pilots[operator.id].charges[0]).toBe(1);
 });
});
