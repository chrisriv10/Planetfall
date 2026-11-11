import {describe,expect,it,vi} from "vitest";
import {PG_MAP,PG_OBJECTIVES,pgCreateGun,pgSpawnMotion,pgStepMovement,type PgPlayer,type Vec3} from "@planetfall/shared";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";
import {PgModeWorld} from "./pg-mode-world.js";
import type {PgModeContext} from "./pg-mode-runtime.js";
import {PgSiege} from "./pg-siege.js";

const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

describe("Siege full capture playthrough",()=>{
 it("walks from the actual round spawn and captures for fifteen seconds with both teams alive",()=>{
  // This intentionally cooperative 1v1 isolates capture from the contested 6v6
  // combat test. The human defender chooses its normal preparation doorway
  // post, then holds that post rather than receiving bot retake orders.
  const players=new Map<string,PgPlayer>();
  for(const team of ["solar","void"]as const){
   const id=`${team}-0`,spawn=PG_MAP.spawns.find(s=>s.team===team)!;
   players.set(id,{...pgSpawnMotion(spawn.position),id,team,isBot:team==="solar",lifeId:0,hp:100,lastDamageAt:-1000,protectedUntil:0,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0}as PgPlayer);
  }
  const spawnCalls:{id:string;position:Vec3}[]=[];
  const ctx:PgModeContext={players,world:new PgModeWorld(),finish:vi.fn(),damage:vi.fn((p,who,amount,now)=>{
   const dealt=mode.damage(p,who,amount,now);
   if(p.hp<=0)mode.eliminated(p,who,"pulse",now);
   return dealt;
  }),respawn(p,now,loadout,position){
   if(!position)throw Error("Siege must supply its round spawn");
   spawnCalls.push({id:p.id,position:{...position}});
   Object.assign(p,pgSpawnMotion(position));p.lifeId++;p.hp=100;p.protectedUntil=now;
   p.guns=[pgCreateGun(loadout?.primary??"pulse"),pgCreateGun(loadout?.secondary??"orbit")];
  }};
  const mode=new PgSiege(ctx);mode.start(0);
  const attacker=players.get("solar-0")!,defender=players.get("void-0")!,point=PG_OBJECTIVES.uplink[0];
  const starts=new Map([...players].map(([id,p])=>[id,{...p.position}]));
  expect(spawnCalls).toHaveLength(2);
  expect(attacker.position).toEqual(spawnCalls.find(s=>s.id===attacker.id)!.position);
  expect(distance(attacker.position,point.position)).toBeGreaterThan(15);
  expect(distance(defender.position,point.position)).toBeLessThan(point.radius);
  const defenderPost=mode.botGoal(defender,0)!;
  expect(distance(defenderPost,point.position)).toBeGreaterThan(point.radius+1);
  const memories=new Map([...players.keys()].map(id=>[id,pgBotMemory()]));
  const travelled=new Map([...players.keys()].map(id=>[id,0]));
  const dt=1/60;
  let actionAt=0,firstCaptureAt=0,captureSteps=0,arrivalAt=0,preparationExitAt=0,finalAt=0;
  let previousCapture=0;
  for(let tick=1;tick<=60*90;tick++){
   const now=tick*1000/60;
   for(const p of players.values()){
    if(!mode.canMove(p))continue;
    const goal=p===attacker?mode.botGoal(p,now):defenderPost;
    const steering=mode.botWaypoint(p,goal),before={...p.position};
    const {input,fire}=pgBotInput(p,players.values(),now,"hard",memories.get(p.id)!,{map:ctx.world.map,goal,steering,grounded:true,visible:()=>false});
    expect(fire).toBe(false);
    pgStepMovement(p,input,dt,now,ctx.world.map,mode.movement(p));
    const step=distance(before,p.position);
    expect(step).toBeLessThanOrEqual(.12);
    travelled.set(p.id,travelled.get(p.id)!+step);
   }
   mode.update(dt,now);
   const state=mode.snapshot();
   if(!preparationExitAt&&distance(defender.position,point.position)>point.radius)preparationExitAt=now;
   if(state.subphase==="prepare"){
    expect(state.capture).toBe(0);
    expect(attacker.position).toEqual(starts.get(attacker.id));
   }else{
    actionAt||=now;
    expect(distance(defender.position,point.position)).toBeGreaterThan(point.radius);
   }
   if(!arrivalAt&&distance(attacker.position,point.position)<=point.radius)arrivalAt=now;
   if(state.capture>previousCapture){
    firstCaptureAt||=now;captureSteps++;
    expect(distance(attacker.position,point.position)).toBeLessThanOrEqual(point.radius);
    expect(state.capture-previousCapture).toBeCloseTo(Math.min(dt/15,1-previousCapture),10);
   }
   if(firstCaptureAt){
    expect(distance(attacker.position,point.position)).toBeLessThanOrEqual(point.radius);
    expect(state.capture).toBeGreaterThanOrEqual(previousCapture);
   }
   for(const p of players.values()){
    expect(p.hp).toBe(mode.maxHp(p));
    expect(p.lifeId).toBe(1);
    expect(state.pilots[p.id].life).toBe("alive");
   }
   if(state.subphase==="intermission"){
    expect(state.capture).toBe(1);expect(state.roundScores).toEqual({solar:1,void:0});
    expect(state.round).toBe(2);expect(state.deadline).toBe(now+5000);finalAt=now;break;
   }
   expect(state.roundScores).toEqual({solar:0,void:0});
   previousCapture=state.capture;
  }
  expect(actionAt).toBe(35000);
  expect(preparationExitAt).toBeGreaterThan(0);expect(preparationExitAt).toBeLessThan(actionAt);
  expect(arrivalAt).toBeGreaterThan(actionAt);expect(firstCaptureAt).toBe(arrivalAt);
  expect(captureSteps).toBeGreaterThanOrEqual(900);expect(captureSteps).toBeLessThanOrEqual(901);
  expect(finalAt-firstCaptureAt+1000/60).toBeGreaterThanOrEqual(15000-1e-6);
  expect(travelled.get(attacker.id)!).toBeGreaterThan(distance(starts.get(attacker.id)!,point.position)-point.radius);
  expect(travelled.get(defender.id)!).toBeGreaterThan(point.radius);
  expect(distance(defender.position,defenderPost)).toBeLessThan(.85);
  expect(spawnCalls).toHaveLength(2);expect(ctx.damage).not.toHaveBeenCalled();expect(ctx.finish).not.toHaveBeenCalled();
 });
});
