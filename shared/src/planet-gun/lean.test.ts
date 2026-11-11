import {describe,expect,it} from "vitest";
import {PG_MAP} from "./map.js";
import {pgSpawnMotion,pgSanitizeInput,pgStepMovement} from "./movement.js";
import {PG_SIEGE_MOVEMENT_RULES} from "./movement-rules.js";
import {pgLeanEye,pgLeanOffset,pgStepLean} from "./lean.js";
import type {PgInput,PgMap} from "./types.js";
import {pgPilotHit} from "./math.js";
const map:PgMap={...PG_MAP,solids:[],navigation:[]};
const input:PgInput={sequence:1,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:true,lean:1};
function motion(){const p=pgSpawnMotion({x:0,y:0,z:0});p.grounded=true;p.mode="ground";return p;}
describe("authoritative Siege leaning",()=>{
 it("exposes the shifted head without enlarging the feet or accepting an obvious miss",()=>{
  const p=motion();p.lean=1;const direction={x:0,y:0,z:-1},feet={x:0,y:0,z:0},edge={x:.68,y:1.49,z:3};
  expect(pgPilotHit(edge,direction,feet,false)).toBeNull();
  expect(pgPilotHit(edge,direction,feet,false,pgLeanOffset(p))?.headshot).toBe(true);
  expect(pgPilotHit({...edge,x:.9},direction,feet,false,pgLeanOffset(p))).toBeNull();
  expect(pgPilotHit({...edge,y:.35},direction,feet,false,pgLeanOffset(p))).toBeNull();
 });
 it("is smooth, symmetric, foot-stationary, yaw-relative and returns to neutral",()=>{
  const p=motion(),feet={...p.position};pgStepLean(p,input,1/30,map,true);expect(p.lean).toBeGreaterThan(0);expect(p.lean).toBeLessThan(.5);
  for(let i=0;i<20;i++)pgStepLean(p,input,1/30,map,true);expect(pgLeanEye(p).x).toBeCloseTo(.32,3);expect(p.position).toEqual(feet);
  p.yaw=Math.PI/2;expect(pgLeanOffset(p).z).toBeCloseTo(-.32,3);
  for(let i=0;i<30;i++)pgStepLean(p,{...input,lean:0},1/30,map,true);expect(p.lean).toBe(0);
  for(let i=0;i<20;i++)pgStepLean(p,{...input,lean:-1},1/30,map,true);expect(pgLeanOffset(p).z).toBeCloseTo(.32,3);
 });
 it("sweeps head/upper body against cover and cannot put the eye through a wall",()=>{
  const p=motion(),wall={id:"lean-wall",kind:"habitat" as const,mantle:false,center:{x:.7,y:1,z:0},half:{x:.1,y:1,z:2}},blocked={...map,solids:[wall]};
  for(let i=0;i<60;i++)pgStepLean(p,input,1/30,blocked,true);
  expect(pgLeanOffset(p).x).toBeGreaterThan(.1);expect(pgLeanOffset(p).x).toBeLessThanOrEqual(.17);expect(pgLeanEye(p).x).toBeLessThan(wall.center.x-wall.half.x);
  p.position.z=3;for(let i=0;i<20;i++)pgStepLean(p,input,1/30,blocked,true);expect(pgLeanOffset(p).x).toBeGreaterThan(.31);
 });
 it("rejects malformed intent, ignores lean outside Siege and clears airborne/sprinting lean",()=>{
  expect(pgSanitizeInput({...input,lean:2})).toBeNull();expect(pgSanitizeInput({...input,lean:.5})).toBeNull();expect(pgSanitizeInput({...input,lean:Number.NaN})).toBeNull();
  const p=motion();p.lean=1;pgStepLean(p,input,1/30,map,false);expect(p.lean).toBe(0);
  p.lean=1;pgStepLean(p,{...input,sprint:true},1/30,map,true);expect(p.lean).toBe(0);p.grounded=false;p.lean=1;pgStepLean(p,input,1/30,map,true);expect(p.lean).toBe(0);
 });
 it("uses the same fixed-step movement policy on both simulation copies",()=>{
  const p=motion(),q=structuredClone(p),floor={id:"floor",kind:"floor"as const,mantle:false,center:{x:0,y:-.5,z:0},half:{x:10,y:.5,z:10}},world={...map,solids:[floor]};
  for(let i=0;i<30;i++){pgStepMovement(p,input,1/30,i*1000/30,world,PG_SIEGE_MOVEMENT_RULES);pgStepMovement(q,input,1/30,i*1000/30,world,PG_SIEGE_MOVEMENT_RULES);}
  expect(p).toEqual(q);expect(p.lean).toBeGreaterThan(.99);pgStepMovement(p,input,1/30,1000,world);expect(p.lean).toBe(0);
 });
});
