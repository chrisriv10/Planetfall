import {describe,expect,it} from "vitest";
import {PG_MAP,PG_TACTICAL_MOVEMENT_RULES,pgCreateGun,pgLeanEye,pgLeanOffset,pgPilotHit,pgSpawnMotion,pgStepMovement,type PgMap,type PgPlayer,type PgSolid,type Vec3} from "@planetfall/shared";
import {PgCombat} from "./pg-combat.js";
import {pgBotFireLane,type PgBotFireLaneOptions} from "./pg-bot-fire-lanes.js";

const solid=(id:string,center:Vec3,half:Vec3):PgSolid=>({id,kind:"structure",center,half,mantle:false});
const floor=solid("floor",{x:5,y:-.5,z:0},{x:20,y:.5,z:8});
const pilot=(id:string,x:number,team:PgPlayer["team"]="solar"):PgPlayer=>({...pgSpawnMotion({x,y:0,z:0}),id,team,hp:100,lifeId:1,grounded:true,connected:true,isBot:true,yaw:-Math.PI/2,pitch:0,slot:0,guns:[pgCreateGun("pulse"),pgCreateGun("comet")],adsSince:500,fireReadyAt:0,protectedUntil:0} as PgPlayer);
function fixture(solids=[floor]) {
 const shooter=pilot("shooter",0),ally=pilot("ally",2),target=pilot("enemy",10,"void");
 const map:PgMap={...PG_MAP,solids,navigation:[]};
 const options:PgBotFireLaneOptions={shooter,observedTarget:target,allies:[shooter,ally],map};
 return {shooter,ally,target,map,options};
}

describe("bounded bot friendly firing lanes",()=>{
 it("reproduces an authoritative wasted shot, then physically walks beside its ally and lands the ordinary shot",()=>{
  const wall=solid("backing-wall",{x:-.65,y:1,z:0},{x:.1,y:1,z:4});
  const {shooter,ally,target,map,options}=fixture([floor,wall]),combat=new PgCombat(),players=[shooter,ally,target];
  combat.history.record(players,1000);
  const before=combat.fire(shooter,{sequence:1,clientTime:1000,weapon:"pulse",yaw:shooter.yaw,pitch:0},players,1000,{solids:map.solids,targets:[],damage(victim,_attacker,amount){victim.hp-=amount;return amount;}})[0];
  expect(before.damage).toBe(0);expect(target.hp).toBe(100);expect(ally.hp).toBe(100);
  const suggestion=pgBotFireLane(options);
  expect(suggestion.blockedBy).toBe(ally.id);expect(suggestion.position).not.toBeNull();
  const destination=suggestion.position!;
  expect(Math.hypot(destination.x-shooter.position.x,destination.z-shooter.position.z)).toBeLessThanOrEqual(2);
  let arrived=false;
  for(let tick=0;tick<180;tick++){
   const dx=destination.x-shooter.position.x,dz=destination.z-shooter.position.z,d=Math.hypot(dx,dz);
   if(d<.08){arrived=true;break;}
   const c=Math.cos(shooter.yaw),s=Math.sin(shooter.yaw),scale=Math.max(1,d);
   const before={...shooter.position};
   pgStepMovement(shooter,{sequence:tick+1,moveX:(dx*c-dz*s)/scale,moveZ:(dx*s+dz*c)/scale,yaw:shooter.yaw,pitch:0,jump:false,sprint:false,crouch:false,ads:true},1/60,1100+tick*1000/60,map,PG_TACTICAL_MOVEMENT_RULES);
   expect(Math.hypot(shooter.position.x-before.x,shooter.position.z-before.z)).toBeLessThan(.15);
   expect(shooter.position.y).toBe(0);
  }
  expect(arrived).toBe(true);expect(pgBotFireLane(options).blockedBy).toBeNull();
  shooter.yaw=Math.atan2(-(target.position.x-shooter.position.x),-(target.position.z-shooter.position.z));
  shooter.pitch=Math.atan2(target.position.y+1.05-pgLeanEye(shooter).y,Math.hypot(target.position.x-shooter.position.x,target.position.z-shooter.position.z));
  combat.history.record(players,5000);
  const after=combat.fire(shooter,{sequence:2,clientTime:5000,weapon:"pulse",yaw:shooter.yaw,pitch:shooter.pitch},players,5000,{solids:map.solids,targets:[],damage(victim,_attacker,amount){victim.hp-=amount;return amount;}})[0];
  expect(after.targetId).toBe(target.id);expect(after.damage).toBeGreaterThan(0);expect(ally.hp).toBe(100);
 });

 it.each([{name:"standing head",height:1.57,crouched:false},{name:"standing torso",height:.72,crouched:false},{name:"standing feet",height:.15,crouched:false},{name:"crouched head",height:1.5,crouched:true},{name:"crouched low body",height:.2,crouched:true}])("uses the canonical $name volume",({height,crouched})=>{
  const {ally,options}=fixture();ally.crouched=crouched;
  const origin={x:0,y:height,z:0},direction={x:1,y:0,z:0};
  expect(pgPilotHit(origin,direction,ally.position,crouched,pgLeanOffset(ally))).not.toBeNull();
  expect(pgBotFireLane({...options,movementAllowed:false,shot:{origin,direction,range:30}}).blockedBy).toBe(ally.id);
 });

 it("checks the actual aim ray and lean without steering aim toward an enemy",()=>{
  const {ally,options}=fixture();ally.yaw=0;ally.lean=1;
  const origin={x:0,y:1.49,z:.4},direction={x:1,y:0,z:0};
  expect(pgBotFireLane({...options,movementAllowed:false,shot:{origin,direction,range:30}}).blockedBy).toBe(ally.id);
  expect(pgBotFireLane({...options,shot:{origin:{...origin,z:1},direction,range:30}})).toEqual({blockedBy:null,position:null});
 });

 it("ignores dead pilots, enemies passed as allies, itself and allies beyond the observed target",()=>{
  const {shooter,ally,target,options}=fixture();ally.hp=0;
  const behind=pilot("behind",12),enemy=pilot("other-enemy",2,"void");
  expect(pgBotFireLane({...options,allies:[shooter,ally,behind,target,enemy]})).toEqual({blockedBy:null,position:null});
 });

 it.each(["doorposts","feet","overhead"])("holds fire when %s geometry obstructs every full body sweep",kind=>{
  const blockers=[-1,1].map(side=>solid(`${kind}-${side}`,{x:0,y:kind==="feet"?.1:kind==="overhead"?1.85:1,z:side*.7},{x:.6,y:kind==="doorposts"?1:.1,z:.1}));
  const {ally,options}=fixture([floor,...blockers]);
  expect(pgBotFireLane(options)).toEqual({blockedBy:ally.id,position:null});
 });

 it("rejects unsupported ledges even when a destination center has support",()=>{
  const {ally,options}=fixture([solid("narrow-floor",{x:5,y:-.5,z:0},{x:20,y:.5,z:1.1})]);
  expect(pgBotFireLane(options)).toEqual({blockedBy:ally.id,position:null});
 });

 it("rejects a supported endpoint across an unsupported gap",()=>{
  const strips=[[-.5,.5],[-2.5,-.9],[.9,2.5]].map(([a,b],index)=>solid(`floor-${index}`,{x:5,y:-.5,z:(a+b)/2},{x:20,y:.5,z:(b-a)/2}));
  const {ally,options}=fixture(strips);
  expect(pgBotFireLane(options)).toEqual({blockedBy:ally.id,position:null});
 });

 it("rejects floor overhang beyond the logical arena bounds",()=>{
  const {ally,options}=fixture();options.map={...options.map,halfDepth:.9};
  expect(pgBotFireLane(options)).toEqual({blockedBy:ally.id,position:null});
 });

 it("takes the safe alternative instead of walking through a friendly capsule off the firing ray",()=>{
  const {options}=fixture(),crew=pilot("crew",0);crew.position.z=-1;
  const lane=pgBotFireLane({...options,allies:[...options.allies,crew]});
  expect(lane.position?.z).toBe(1);
  const other=pilot("other-crew",0);other.position.z=1;
  expect(pgBotFireLane({...options,allies:[...options.allies,crew,other]})).toEqual({blockedBy:"ally",position:null});
 });

 it("preserves stationary interactions, airborne motion, objective bounds and doorway constraints",()=>{
  const {shooter,ally,options}=fixture(),position={...shooter.position};
  for(const constraint of [{movementAllowed:false},{objectiveArea:{position,radius:.9}},{allowPosition:()=>false}])expect(pgBotFireLane({...options,...constraint})).toEqual({blockedBy:ally.id,position:null});
  shooter.grounded=false;expect(pgBotFireLane(options)).toEqual({blockedBy:ally.id,position:null});
  expect(shooter.position).toEqual(position);
 });
});
