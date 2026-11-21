import {describe,it,expect} from "vitest";
import {PG_BALANCE as B} from "./balance.js";
import {PG_MAP} from "./map.js";
import {pgSpawnMotion,pgStepMovement,pgSanitizeInput,pgCapsuleClear} from "./movement.js";
import type {PgInput,PgMap,PgMotion,PgSolid} from "./types.js";
const floor:PgSolid={id:"floor",kind:"floor",center:{x:0,y:-.5,z:0},half:{x:100,y:.5,z:100},mantle:false};
const arena=(extras:PgSolid[]=[]):PgMap=>({...PG_MAP,solids:[floor,...extras]});
const input=(v:Partial<PgInput>={}):PgInput=>({sequence:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false,...v});
function pilot(){const p=pgSpawnMotion({x:0,y:0,z:0});p.grounded=true;return p;}
function step(p:PgMotion,v:Partial<PgInput>,count:number,map=arena(),start=0){for(let i=0;i<count;i++)pgStepMovement(p,input(v),1/60,start+i*1000/60,map);}
describe("PlanetGun authoritative/predicted movement",()=>{
 it("sanitizes input and caps planar input magnitude",()=>{expect(pgSanitizeInput({...input(),yaw:NaN})).toBeNull();const i=pgSanitizeInput(input({moveX:5,moveZ:5}))!;expect(Math.hypot(i.moveX,i.moveZ)).toBeCloseTo(1);});
 it("accelerates to sprint rather than teleporting velocity",()=>{const p=pilot();step(p,{moveZ:-1,sprint:true},1);expect(-p.velocity.z).toBeGreaterThan(0);expect(-p.velocity.z).toBeLessThan(B.sprintSpeed);step(p,{moveZ:-1,sprint:true},120);expect(-p.velocity.z).toBeCloseTo(B.sprintSpeed);});
 it("normal jumps lift the pilot, holding thrust extends height and spends Ion",()=>{const normal=pilot(),boosted=pilot();step(normal,{jump:true},1);let normalMax=0,boostMax=0,minIon=100;for(let i=1;i<240;i++){step(normal,{},1,arena(),i*1000/60);step(boosted,{jump:true},1,arena(),i*1000/60);normalMax=Math.max(normalMax,normal.position.y);boostMax=Math.max(boostMax,boosted.position.y);minIon=Math.min(minIon,boosted.ion);}expect(boostMax).toBeGreaterThan(normalMax+1);expect(boostMax).toBeLessThanOrEqual(B.maxJumpRise+.5);expect(minIon).toBeLessThan(30);});
 it("regenerates Ion on the ground without exceeding capacity",()=>{const p=pilot();p.ion=10;step(p,{},180);expect(p.ion).toBe(100);});
 it("slides with decay then can jump without discarding planar momentum",()=>{const p=pilot();p.velocity.z=-10;step(p,{moveZ:-1,sprint:true,crouch:true},1);expect(p.mode).toBe("slide");const initial=-p.velocity.z;step(p,{moveZ:-1,sprint:true,crouch:true},15,arena(),20);expect(-p.velocity.z).toBeLessThan(initial);step(p,{moveZ:-1,jump:true},1,arena(),280);expect(p.velocity.y).toBeGreaterThan(7);expect(-p.velocity.z).toBeGreaterThan(7);});
 it("rejects arbitrary non-tagged walls and enters only authored run surfaces",()=>{const wall:PgSolid={id:"run",kind:"wall-run",center:{x:0,y:2,z:0},half:{x:.3,y:2,z:12},mantle:false,wallRunFaces:["x+"]};const p=pgSpawnMotion({x:.73,y:1,z:0});p.velocity.z=-9;step(p,{moveZ:-1},1,arena([wall]),1000);expect(p.wallId).toBe("run");expect(p.ion).toBeLessThan(100);const q=pgSpawnMotion({x:.73,y:1,z:0});q.velocity.z=-9;step(q,{moveZ:-1},1,arena([{...wall,wallRunFaces:undefined}]),1000);expect(q.wallId).toBeNull();});
 it("wall jumps push away and cannot immediately reacquire the same wall",()=>{const p=pgSpawnMotion({x:.73,y:2,z:0});p.wallId="run";p.wallNormal={x:1,y:0,z:0};p.wallUntil=2000;p.velocity.z=-9;step(p,{moveZ:-1,jump:true},1,arena(),1000);expect(p.velocity.x).toBeGreaterThan(5);expect(p.velocity.y).toBeGreaterThan(7);expect(p.wallId).toBeNull();expect(p.wallReadyAt).toBeGreaterThan(1000);});
 it("settles a real jump into the north wall run instead of carrying jump ascent over its top",()=>{
  const p=pgSpawnMotion({x:-10,y:0,z:-30.23},-Math.PI/2);p.grounded=true;p.velocity.x=B.runSpeed;
  let highest=0,runTicks=0;
  for(let i=0;i<60;i++){step(p,{moveZ:-1,yaw:-Math.PI/2,jump:true},1,PG_MAP,1000+i*1000/60);highest=Math.max(highest,p.position.y);if(p.mode==="wall-run")runTicks++;}
  expect(runTicks).toBeGreaterThan(40);expect(highest).toBeLessThan(2);expect(p.position.x).toBeGreaterThan(-4);expect(p.ion).toBeLessThan(80);
 });
 it("mantles only marked, broad, head-clear ledges",()=>{const b:PgSolid={id:"ledge",kind:"utility",center:{x:0,y:.8,z:-1.4},half:{x:2,y:.8,z:.7},mantle:true};const p=pgSpawnMotion({x:0,y:.5,z:0});p.velocity.z=-8;step(p,{moveZ:-1,jump:true},3,arena([b]),1000);expect(p.mantleTo).not.toBeNull();step(p,{moveZ:-1},18,arena([b]),1050);expect(p.position.y).toBeCloseTo(1.6);const q=pgSpawnMotion({x:0,y:.5,z:0});q.velocity.z=-8;step(q,{moveZ:-1,jump:true},3,arena([{...b,mantle:false}]),1000);expect(q.mantleTo).toBeNull();});
 it("bounds speed and energy through repeated slide/thrust input",()=>{const p=pilot();for(let i=0;i<1800;i++){step(p,{moveZ:-1,sprint:true,crouch:i%50<25,jump:i%60<40},1,arena(),i*1000/60);expect(Math.hypot(p.velocity.x,p.velocity.z)).toBeLessThanOrEqual(B.maxSpeed+.0001);expect(p.ion).toBeGreaterThanOrEqual(0);expect(p.ion).toBeLessThanOrEqual(100);}expect(Number.isFinite(p.position.y)).toBe(true);});
 it("has collision-clear authored team spawns and explicit traversal graph links",()=>{for(const spawn of PG_MAP.spawns)expect(pgCapsuleClear(spawn.position,B.height)).toBe(true);for(const kind of ["jump","mantle","wall-run"])expect(PG_MAP.navigation.some(n=>n.links.some(l=>l.kind===kind))).toBe(true);});
 it("predicts identical states when the same inputs are replayed",()=>{const authority=pilot(),prediction=pilot();for(let i=0;i<300;i++){const v={moveZ:-1,sprint:true,jump:i>30&&i<80,crouch:i>150&&i<180};step(authority,v,1,arena(),i*1000/60);step(prediction,v,1,arena(),i*1000/60);}expect(prediction).toEqual(authority);});
 it("walks both authored stair flights into the upper interiors without jumping",()=>{
  for(const [x,z,direction]of [[-31,-1,-1],[32,4,1]]){
   const p=pgSpawnMotion({x,y:0,z});p.grounded=true;step(p,{moveZ:direction},110,PG_MAP);
   expect(p.position.y,JSON.stringify(p.position)).toBeCloseTo(3.5);expect(p.grounded).toBe(true);expect(pgCapsuleClear(p.position,B.height)).toBe(true);
  }
 });
});

describe("Nova Block deck rail collision",()=>{
 const northRail=PG_MAP.solids.find(b=>b.id==="deck-rail-north")!;
 const inside=northRail.center.z+northRail.half.z+B.radius;

 it("resolves the captured landing off the front face of the north rail",()=>{
  const p=pgSpawnMotion({x:-21.008344116934055,y:1.36,z:-36.9058333333333},1.2957963267948966);
  p.velocity={x:.4,y:-6.2,z:-.9333333333333247};
  step(p,{yaw:p.yaw},2,PG_MAP,1000);
  expect(p.position.x).toBeCloseTo(-21.001677450267387,10);
  expect(p.position.z).toBeCloseTo(inside,10);
  expect(p.position.y).toBeCloseTo(1.1333333333333333,10);
  expect(p.velocity.x).toBeCloseTo(.1333333333333334,10);
  expect(p.velocity.z).toBe(0);
  expect(p.velocity.y).toBeCloseTo(-7,10);
  expect(p.grounded).toBe(false);
  expect(pgCapsuleClear(p.position,B.height)).toBe(true);
  step(p,{yaw:p.yaw},20,PG_MAP,1034);
  expect(p.position.y).toBe(0);
  expect(p.grounded).toBe(true);
 });

 it.each([
  [-20,-36.91,.3,-.8,-6],
  [15,-36.97,-1.2,.5,-4],
  [0,-38.07,1.1,.6,-8],
  [-30,-37.98,0,0,-2],
  [-44.96,-36.94,.6,-.9,-6],
  [44.96,-36.94,-.6,-.9,-4],
  [46.06,-37.52,-.6,0,-6],
  [-46.06,-37.52,.6,0,-8]
 ])("keeps a descent at x=%s z=%s local to the contacted rail face",(x,z,vx,vz,vy)=>{
  const p=pgSpawnMotion({x,y:1.25,z});
  p.velocity={x:vx,y:vy,z:vz};
  for(let i=0;i<5;i++){
   const before={...p.position};
   step(p,{},1,PG_MAP,1000+i*1000/60);
   expect(Math.hypot(p.position.x-before.x,p.position.z-before.z)).toBeLessThan(.55);
   expect(pgCapsuleClear(p.position,B.height)).toBe(true);
  }
 });

 it.each([false,true])("blocks ground approaches from both sides and allows tangential travel (sprint=%s)",sprint=>{
  const railMap=arena([northRail]);
  for(const direction of [-1,1]){
   const p=pgSpawnMotion({x:-21,y:0,z:northRail.center.z-direction*2});
   p.grounded=true;
   step(p,{moveX:.8,moveZ:direction*.6,sprint},65,railMap);
   const boundary=northRail.center.z-direction*(northRail.half.z+B.radius);
   expect(p.position.z).toBeCloseTo(boundary,8);
   expect(p.position.x).toBeGreaterThan(-17);
   expect(p.velocity.x).toBeGreaterThan(0);
   expect(p.grounded).toBe(true);
   expect(pgCapsuleClear(p.position,B.height,railMap)).toBe(true);
  }
 });

 it("blocks a slide into the rail while keeping the slide's tangential movement",()=>{
  const p=pgSpawnMotion({x:-21,y:0,z:inside+.2});
  p.grounded=true;
  p.velocity={x:7,y:0,z:-6};
  for(let i=0;i<10;i++){
   step(p,{moveX:.8,moveZ:-.6,sprint:true,crouch:true},1,PG_MAP,1000+i*1000/60);
   expect(p.position.z).toBeGreaterThanOrEqual(inside-.01);
  }
  expect(p.mode).toBe("slide");
  expect(p.position.z).toBeLessThanOrEqual(inside);
  expect(pgCapsuleClear(p.position,B.crouchHeight)).toBe(true);
  expect(p.position.x).toBeGreaterThan(-20.5);
  expect(p.grounded).toBe(true);
 });
});
