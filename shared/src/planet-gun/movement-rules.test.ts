import {describe,it,expect} from "vitest";
import {PG_MAP} from "./map.js";
import {pgSpawnMotion,pgStepMovement} from "./movement.js";
import {PG_DEFAULT_MOVEMENT_RULES as D,PG_TACTICAL_MOVEMENT_RULES as T,PG_DOWNED_MOVEMENT_RULES as C} from "./movement-rules.js";
import type {PgInput,PgMap} from "./types.js";
const map:PgMap={...PG_MAP,solids:[PG_MAP.solids[0]]};
const input=(values:Partial<PgInput>={}):PgInput=>({sequence:0,moveX:0,moveZ:-1,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false,...values});
describe("PlanetGun movement rule policy",()=>{
 it("preserves every default state with an explicit default policy",()=>{
  const a=pgSpawnMotion({x:0,y:0,z:0}),b=pgSpawnMotion({x:0,y:0,z:0});
  for(let i=0;i<500;i++){const v=input({jump:i%90<40,sprint:true,crouch:i%120>90});pgStepMovement(a,v,1/60,i*1000/60,map);pgStepMovement(b,v,1/60,i*1000/60,map,D);expect(a).toEqual(b);}
 });
 it("supports tactical walk, sprint, crouch and jumps without thrust or slide",()=>{
  for(const [values,speed] of [[{},T.walkSpeed],[{sprint:true},T.sprintSpeed],[{sprint:true,crouch:true},T.crouchSpeed]] as const){
   const p=pgSpawnMotion({x:0,y:0,z:0});p.grounded=true;
   for(let i=0;i<60;i++)pgStepMovement(p,input(values),1/60,i*1000/60,map,T);
   expect(-p.velocity.z).toBeCloseTo(speed);expect(p.slideUntil).toBe(0);
  }
  const held=pgSpawnMotion({x:0,y:0,z:0}),released=pgSpawnMotion({x:0,y:0,z:0});held.grounded=released.grounded=true;
  for(let i=0;i<40;i++){pgStepMovement(held,input({jump:true}),1/60,i*1000/60,map,T);pgStepMovement(released,input({jump:i===0}),1/60,i*1000/60,map,T);expect(held.position).toEqual(released.position);expect(held.ion).toBe(100);}
  expect(held.lastJumpAt).toBe(0);
 });
 it("clears disabled traversal even when changing policy mid-move",()=>{
  const p=pgSpawnMotion({x:0,y:1,z:0});p.wallId="old-wall";p.wallUntil=5000;p.slideUntil=5000;p.velocity.z=-9;
  pgStepMovement(p,input({jump:true,sprint:true,crouch:true}),1/60,1000,map,T);
  expect(p.wallId).toBeNull();expect(p.slideUntil).toBe(0);expect(p.mode).toBe("air");expect(Math.hypot(p.velocity.x,p.velocity.z)).toBeLessThanOrEqual(T.maxSpeed);
 });
 it("allows tactical mantles while rejecting authored wall-run assistance",()=>{
  const ledge={id:"ledge",kind:"utility" as const,center:{x:0,y:.8,z:-1.4},half:{x:2,y:.8,z:.7},mantle:true};
  const p=pgSpawnMotion({x:0,y:.5,z:0});p.velocity.z=-6;
  for(let i=0;i<5;i++)pgStepMovement(p,input({jump:true}),1/60,1000+i*1000/60,{...map,solids:[...map.solids,ledge]},T);
  expect(p.mantleTo).not.toBeNull();
  const wall={id:"run",kind:"wall-run" as const,center:{x:0,y:2,z:0},half:{x:.3,y:2,z:12},mantle:false,wallRunFaces:["x+" as const]};
  const q=pgSpawnMotion({x:.73,y:1,z:0});q.velocity.z=-9;
  pgStepMovement(q,input(),1/60,1000,{...map,solids:[...map.solids,wall]},T);
  expect(q.wallId).toBeNull();expect(q.mode).toBe("air");expect(q.velocity.y).toBeLessThan(0);
 });
 it("keeps downed players crawling with no jumps, thrust, mantle or sprint",()=>{
  const p=pgSpawnMotion({x:0,y:0,z:0});p.grounded=true;p.jumpBufferUntil=5000;p.mantleFrom={...p.position};p.mantleTo={x:0,y:3,z:0};
  for(let i=0;i<90;i++)pgStepMovement(p,input({jump:true,sprint:true}),1/60,i*1000/60,map,C);
  expect(p.position.y).toBe(0);expect(p.crouched).toBe(true);expect(p.mantleTo).toBeNull();expect(p.jumpBufferUntil).toBe(0);expect(-p.velocity.z).toBeCloseTo(C.maxSpeed);expect(p.ion).toBe(100);
 });
});
