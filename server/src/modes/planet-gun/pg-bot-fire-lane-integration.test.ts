import {describe,expect,it} from "vitest";
import {PG_MAP,PG_TACTICAL_MOVEMENT_RULES,pgAim,pgCreateGun,pgLeanEye,pgLeanOffset,pgPilotHit,pgSpawnMotion,pgStepMovement,type PgMap,type PgPlayer,type Vec3} from "@planetfall/shared";
import {pgBotInput,pgBotMemory,type PgBotContext} from "./pg-bots.js";

const pilot=(id:string,x:number,team:PgPlayer["team"]="solar"):PgPlayer=>({...pgSpawnMotion({x,y:0,z:0}),id,team,hp:100,lifeId:1,grounded:true,connected:true,isBot:true,yaw:-Math.PI/2,pitch:0,slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],adsSince:500,fireReadyAt:0,protectedUntil:0} as PgPlayer);
type Context=PgBotContext&{combatArea?:{position:Vec3;radius:number};allowCombatReposition?:boolean};
function fixture(){
 const shooter=pilot("lane-shooter",0),ally=pilot("lane-ally",2),target=pilot("lane-target",10,"void");
 const map:PgMap={...PG_MAP,halfWidth:30,halfDepth:10,navigation:[],solids:[
  {id:"floor",kind:"structure",center:{x:0,y:-.5,z:0},half:{x:30,y:.5,z:10},mantle:false},
  {id:"back-wall",kind:"structure",center:{x:-.65,y:1,z:0},half:{x:.1,y:1,z:4},mantle:false},
 ]};
 const goal={x:0,y:0,z:1.5},memory=pgBotMemory(),all=[shooter,ally,target];
 const context=():Context=>({map,goal,steering:{...shooter.position},grounded:true,visible:()=>true,combatArea:{position:{x:0,y:0,z:0},radius:3},allowCombatReposition:true});
 return {shooter,ally,target,map,goal,memory,all,context};
}
function friendlyHit(shooter:PgPlayer,ally:PgPlayer,input:{yaw:number;pitch:number}){
 return pgPilotHit(pgLeanEye(shooter),pgAim(input.yaw,input.pitch),ally.position,ally.crouched,pgLeanOffset(ally));
}
function movement(input:{yaw:number;moveX:number;moveZ:number}){
 const c=Math.cos(input.yaw),s=Math.sin(input.yaw);
 return {x:input.moveX*c+input.moveZ*s,z:-input.moveX*s+input.moveZ*c};
}

describe("bot input friendly firing lane integration",()=>{
 it("holds fire whenever its actual returned shot ray hits a friendly pilot",()=>{
  const f=fixture();let observedBlockedReadyAim=false;
  for(let tick=0;tick<120;tick++){
   const now=1000+tick*1000/60,result=pgBotInput(f.shooter,f.all,now,"normal",f.memory,{...f.context(),allowCombatReposition:false});
   if(now>1400&&friendlyHit(f.shooter,f.ally,result.input)){
    observedBlockedReadyAim=true;expect(result.fire,"actual friendly-occluded input must not request a wasted shot").toBe(false);
   }
   f.shooter.yaw=result.input.yaw;f.shooter.pitch=result.input.pitch;
  }
  expect(observedBlockedReadyAim).toBe(true);
 });

 it("gates actual noisy aim even when the ideal enemy center ray misses the friendly head",()=>{
  const f=fixture();let found=false;
  for(let tick=0;tick<180;tick++){
   const now=1000+tick*1000/60,ctx={...f.context(),allowCombatReposition:false};
   const warmed=pgBotInput(f.shooter,[f.shooter,f.target],now,"normal",f.memory,ctx);
   f.shooter.yaw=warmed.input.yaw;f.shooter.pitch=warmed.input.pitch;
   if(!warmed.fire)continue;
   const eye=pgLeanEye(f.shooter),ray=pgAim(warmed.input.yaw,warmed.input.pitch);
   if(Math.abs(ray.z)<.003)continue;
   f.ally.position={x:2,y:eye.y+ray.y*(2-eye.x)/ray.x-1.49,z:Math.sign(ray.z)*.4301};
   const idealAim={x:10,y:1.05,z:0},length=Math.hypot(idealAim.x-eye.x,idealAim.y-eye.y,idealAim.z-eye.z);
   const ideal={x:(idealAim.x-eye.x)/length,y:(idealAim.y-eye.y)/length,z:(idealAim.z-eye.z)/length};
   if(pgPilotHit(eye,ideal,f.ally.position,false,pgLeanOffset(f.ally))||!friendlyHit(f.shooter,f.ally,warmed.input))continue;
   const actual=pgBotInput(f.shooter,f.all,now,"normal",f.memory,ctx);
   expect(friendlyHit(f.shooter,f.ally,actual.input)).not.toBeNull();
   expect(actual.fire,"actual aim must be checked independently of the ideal target lane").toBe(false);
   found=true;break;
  }
  expect(found,"fixture must expose actual-ray-only friendly occlusion").toBe(true);
 });

 it("physically walks a bounded lateral lane within the capture area without changing its objective",()=>{
  const f=fixture(),initial={...f.shooter.position},objective={...f.goal};let maxLateral=0,clearedAndFired=false;
  for(let tick=0;tick<300;tick++){
   const now=1000+tick*1000/60,{input,fire}=pgBotInput(f.shooter,f.all,now,"normal",f.memory,f.context());
   if(fire){expect(friendlyHit(f.shooter,f.ally,input)).toBeNull();clearedAndFired=true;}
   const before={...f.shooter.position};
   pgStepMovement(f.shooter,input,1/60,now,f.map,PG_TACTICAL_MOVEMENT_RULES);
   const moved=Math.hypot(f.shooter.position.x-before.x,f.shooter.position.z-before.z);
   expect(moved).toBeLessThan(.15);expect(f.shooter.position.y).toBe(0);
   expect(Math.hypot(f.shooter.position.x,f.shooter.position.z)+.42).toBeLessThanOrEqual(3);
   maxLateral=Math.max(maxLateral,Math.hypot(f.shooter.position.x-initial.x,f.shooter.position.z-initial.z));
   expect(f.goal).toEqual(objective);
   if(clearedAndFired)break;
  }
  expect(maxLateral).toBeGreaterThan(.5);expect(maxLateral).toBeLessThanOrEqual(2.1);
  expect(clearedAndFired).toBe(true);
 });

 it("keeps a stationary interaction at its feet and still suppresses blocked fire",()=>{
  const f=fixture();let ready=false;
  for(let tick=0;tick<100;tick++){
   const now=1000+tick*1000/60,{input,fire}=pgBotInput(f.shooter,f.all,now,"normal",f.memory,{...f.context(),goal:{...f.shooter.position},allowCombatReposition:false});
   expect(Math.hypot(input.moveX,input.moveZ)).toBe(0);
   if(now>1400&&friendlyHit(f.shooter,f.ally,input)){ready=true;expect(fire).toBe(false);}
  }
  expect(ready).toBe(true);
 });

 it.each(["lost target","different target","new life"])("discards a pending lane after %s",change=>{
  const f=fixture();let planned=false,plannedAt=1000;
  for(let tick=0;tick<100;tick++){
   const {input}=pgBotInput(f.shooter,f.all,1000+tick*1000/60,"normal",f.memory,f.context());
   if(Math.hypot(input.moveX,input.moveZ)>.1){planned=true;plannedAt=1000+tick*1000/60;break;}
  }
  expect(planned,"friendly occlusion should produce a physical side lane").toBe(true);
  if(change==="lost target")f.target.hp=0;
  else if(change==="different target"){f.target.id="new-observed-target";f.target.position={x:0,y:0,z:8};}
  else {f.shooter.lifeId++;f.shooter.position={x:20,y:0,z:0};}
  const ctx=f.context();ctx.combatArea={position:{...f.shooter.position},radius:3};
  const {input}=pgBotInput(f.shooter,f.all,plannedAt+1000/60,"normal",f.memory,ctx),world=movement(input);
  expect(Math.hypot(world.x,world.z),"stale side destination must not survive changed target/life").toBe(0);
 });
});

it("uses its safe lane instead of the generic close-range strafe into a teammate",()=>{
 const f=fixture(),crew=pilot("lane-crew",0);crew.position.z=1;
 f.map.navigation=[{id:0,position:{x:0,y:0,z:0},links:[]}];
 const {input}=pgBotInput(f.shooter,[...f.all,crew],1000,"normal",f.memory,{map:f.map,goal:null,grounded:true,visible:()=>true,allowCombatReposition:true});
 const world=movement(input);expect(world.z).toBeLessThan(0);expect(Math.abs(world.x)).toBeLessThan(.001);
});
