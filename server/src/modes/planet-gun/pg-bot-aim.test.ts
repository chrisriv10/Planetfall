import {describe,expect,it} from "vitest";
import {PG_MAP,PG_BALANCE,pgCreateGun,pgGunProfile,pgSpawnMotion,type BotDifficulty,type PgPlayer} from "@planetfall/shared";
import {pgBotAim} from "./pg-bot-aim.js";
import {pgBotInput,pgBotMemory} from "./pg-bots.js";
import {PgCombat} from "./pg-combat.js";
const player=(id="aim-bot",x=0,z=0)=>({...pgSpawnMotion({x,y:0,z}),id,team:"solar",hp:100,grounded:true,isBot:true,connected:true,guns:[pgCreateGun("pulse"),pgCreateGun("orbit")],slot:0,fireReadyAt:0,protectedUntil:0} as PgPlayer);
const enemy=(x=0,z=-20)=>({...player("enemy",x,z),team:"void"} as PgPlayer);
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

describe("fair bot aim",()=>{
 it.each(["easy","normal","hard"] as const)("bounds a 180 degree acquisition turn on %s",difficulty=>{
  const p=player(),target=enemy(0,20),speed={easy:3,normal:5,hard:7}[difficulty];
  let m:ReturnType<typeof pgBotAim>["memory"]|undefined,previous=0,firstFacing=0;
  for(let tick=0;tick<120;tick++){
   const now=tick*1000/60,result=pgBotAim(p,target,now,difficulty,0,m);m=result.memory;
   expect(Math.abs(angle(result.yaw-previous))).toBeLessThanOrEqual(speed/60+1e-9);
   if(result.facing&&!firstFacing)firstFacing=now;previous=result.yaw;
  }
  expect(firstFacing).toBeGreaterThan(350);expect(firstFacing).toBeLessThan(1600);
 });

 it.each([false,true])("aims from the same authoritative eye height when crouched=%s",crouched=>{
  const p=player(""),target=enemy();p.crouched=target.crouched=crouched;
  let result=pgBotAim(p,target,0,"hard",0),m=result.memory;
  // Isolate vertical geometry from the deliberate hand-error presentation.
  m.noisePhase=-100*.0017-1.3/.71;
  result=pgBotAim(p,target,100,"hard",0,m);
  const eye=p.position.y+(crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye),chest=target.position.y+(crouched?.76:1.05);
  expect(result.memory.sample!.y).toBe(chest);
  expect(result.pitch).toBeCloseTo(Math.atan2(chest-eye,20),10);
 });

 it("tracks sampled visible positions with delay and misses a laterally moving target",()=>{
  const p=player(),target=enemy(),difficulty="normal";
  let m:ReturnType<typeof pgBotAim>["memory"]|undefined,misses=0,attempts=0;
  for(let tick=0;tick<240;tick++){
   const now=tick*1000/60;if(tick>60)target.position.x=Math.sin((now-1000)*.006)*8;
   const result=pgBotAim(p,target,now,difficulty,0,m);m=result.memory;
   if(tick===61){expect(m.sample!.x).toBe(0);expect(Math.abs(result.yaw)).toBeLessThan(.05);}
   if(tick>90&&result.facing){
    attempts++;const exact=Math.atan2(-target.position.x,-target.position.z),range=Math.hypot(target.position.x,target.position.z);
    if(Math.abs(Math.sin(angle(result.yaw-exact)))*range>PG_BALANCE.radius)misses++;
   }
  }
  expect(attempts).toBeGreaterThan(20);expect(misses/attempts).toBeGreaterThan(.3);
 });

 it("loses tracking and fire immediately on occlusion, then reacts again on reacquisition",()=>{
  const p=player(),target=enemy(),m=pgBotMemory();let visible=true,fired=false;
  const ctx={map:PG_MAP,goal:null,steering:null,visible:()=>visible};
  for(let tick=0;tick<60;tick++)fired||=pgBotInput(p,[p,target],1000+tick*1000/60,"normal",m,ctx).fire;
  expect(fired).toBe(true);visible=false;
  expect(pgBotInput(p,[p,target],2000,"normal",m,ctx).fire).toBe(false);
  expect(m.aim!.sample).toBeNull();expect(m.aim!.pending).toEqual([]);
  visible=true;expect(pgBotInput(p,[p,target],2016,"normal",m,ctx).fire).toBe(false);
  expect(m.fireAt).toBe(2316);
  expect(pgBotInput(p,[p,target],2300,"normal",m,ctx).fire).toBe(false);
  expect(pgBotInput(p,[p,target],2333,"normal",m,ctx).fire).toBe(true);
 });

 it("applies canonical recoil only for accepted shots, including weapon modules",()=>{
  const p=player();p.guns[0]=pgCreateGun("pulse",["gyro-stabilizer"]);
  let result=pgBotAim(p,undefined,1000,"normal",0),m=result.memory;
  const combat=new PgCombat(),request=(sequence:number)=>({sequence,clientTime:1000,weapon:p.guns[0].id,yaw:0,pitch:0});
  expect(combat.fire(p,request(1),[p],1000)).toHaveLength(1);
  result=pgBotAim(p,undefined,1000,"normal",0,m);m=result.memory;
  expect(result.pitch).toBeCloseTo(pgGunProfile(p.guns[0]).recoil);
  const acceptedPitch=result.pitch;
  expect(combat.fire(p,request(2),[p],1000)).toHaveLength(0);
  result=pgBotAim(p,undefined,1000,"normal",0,m);
  expect(result.pitch).toBe(acceptedPitch);expect(p.guns[0].shots).toBe(1);
  result=pgBotAim(p,undefined,1200,"normal",0,result.memory);
  expect(result.pitch).toBeLessThan(acceptedPitch);expect(result.pitch).toBeGreaterThan(0);
 });

 it("keeps Hard stronger than Normal and Easy without instant acquisition",()=>{
  const times=(["easy","normal","hard"] as BotDifficulty[]).map(difficulty=>{
   const p=player(),target=enemy(0,20),m=pgBotMemory(),ctx={map:PG_MAP,goal:null,steering:null,visible:()=>true};
   p.lastAttacker=target.id;p.lastDamageAt=0;
   for(let tick=0;tick<150;tick++){const now=tick*1000/60;if(pgBotInput(p,[p,target],now,difficulty,m,ctx).fire)return now;}
   return Infinity;
  });
  expect(times[2]).toBeGreaterThan(350);expect(times[2]).toBeLessThan(times[1]);expect(times[1]).toBeLessThan(times[0]);
 });

 it("converts movement with the actual slewing aim yaw",()=>{
  const p=player(),target=enemy(0,20),m=pgBotMemory();
  p.lastAttacker=target.id;p.lastDamageAt=1000;
  const {input}=pgBotInput(p,[p,target],1000,"normal",m,{map:PG_MAP,goal:null,steering:{x:8,y:0,z:0},visible:()=>true});
  const worldX=input.moveX*Math.cos(input.yaw)+input.moveZ*Math.sin(input.yaw);
  const worldZ=-input.moveX*Math.sin(input.yaw)+input.moveZ*Math.cos(input.yaw);
  expect(worldX).toBeCloseTo(1);expect(worldZ).toBeCloseTo(0);expect(input.yaw).toBeCloseTo(0);
 });
});
