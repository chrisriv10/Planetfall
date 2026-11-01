import {describe,it,expect} from "vitest";
import {PG_BALANCE as B} from "./balance.js";
import {PG_MAP} from "./map.js";
import {pgRayBox} from "./math.js";
import {pgCapsuleClear,pgSpawnMotion,pgStepMovement} from "./movement.js";
import {PG_TACTICAL_MOVEMENT_RULES} from "./movement-rules.js";
import {PG_PANEL_SOCKETS,pgAcceptCollisionSnapshot,pgCloneCollisionSnapshot,pgCollisionMap,pgCreateCollisionSnapshot,pgHasLineOfSight} from "./mode-collision.js";

describe("PlanetGun room-local collision",()=>{
 it("adds panels without leaking into another room, its snapshot, or the base map",()=>{
  const before=JSON.stringify(PG_MAP),a=pgCreateCollisionSnapshot(),b=pgCreateCollisionSnapshot(false);
  const closed=pgCollisionMap(a),open=pgCollisionMap(b);
  expect(closed.solids).toHaveLength(PG_MAP.solids.length+a.panels.length);
  expect(open.solids).toEqual(PG_MAP.solids);
  closed.solids.at(-1)!.center.x+=10;
  expect(a.panels.at(-1)!.solid.center.x).toBe(-2);
  expect(JSON.stringify(PG_MAP)).toBe(before);
  expect(pgCollisionMap(b).solids).toEqual(PG_MAP.solids);
 });
 it("authors two grounded, capsule-clear, real approaches per compound",()=>{
  for(const compound of ["west","east","maintenance"]){
   const sockets=PG_PANEL_SOCKETS.filter(s=>s.compound===compound);
   expect(sockets.length).toBeGreaterThanOrEqual(2);
   for(const socket of sockets){
    expect(pgCapsuleClear({...socket.solid.center,y:0},B.height),socket.id).toBe(true);
    for(const approach of socket.approaches){
     expect(pgCapsuleClear(approach,B.height),socket.id).toBe(true);
     const p=pgSpawnMotion(approach);pgStepMovement(p,{sequence:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false},1/60,0);
     expect(p.grounded,socket.id).toBe(true);
    }
    expect(pgHasLineOfSight({...socket.approaches[0],y:1},{...socket.approaches[1],y:1}),socket.id).toBe(true);
   }
  }
 });
 it("closed panels block capsules and bullets, destroyed panels open the same paths",()=>{
  const snapshot=pgCreateCollisionSnapshot(),closed=pgCollisionMap(snapshot);
  for(const socket of PG_PANEL_SOCKETS){
   const feet={...socket.solid.center,y:0},from={...socket.approaches[0],y:1},to={...socket.approaches[1],y:1};
   expect(pgCapsuleClear(feet,B.height,closed),socket.id).toBe(false);
   expect(pgHasLineOfSight(from,to,closed),socket.id).toBe(false);
   const opened=pgCloneCollisionSnapshot(snapshot);opened.panels.find(p=>p.id===socket.id)!.active=false;
   const map=pgCollisionMap(opened);
   expect(pgCapsuleClear(feet,B.height,map),socket.id).toBe(true);
   expect(pgHasLineOfSight(from,to,map),socket.id).toBe(true);
   const distance=Math.hypot(to.x-from.x,to.z-from.z),direction={x:(to.x-from.x)/distance,y:0,z:(to.z-from.z)/distance};
   expect(pgRayBox(from,direction,socket.solid)).not.toBeNull();
   // Walk across the opening using the same bounded movement as authority.
   const motion=pgSpawnMotion(socket.approaches[0]);motion.grounded=true;
   for(let i=0;i<50;i++)pgStepMovement(motion,{sequence:i,moveX:direction.x,moveZ:direction.z,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false},1/60,i*1000/60,map,PG_TACTICAL_MOVEMENT_RULES);
   expect((motion.position.x-feet.x)*direction.x+(motion.position.z-feet.z)*direction.z,socket.id).toBeGreaterThan(.5);
  }
 });
 it("never silently replaces a base wall",()=>{
  const snapshot=pgCreateCollisionSnapshot();snapshot.panels[0].solid.id=PG_MAP.solids[0].id;
  expect(()=>pgCollisionMap(snapshot)).toThrow("Duplicate");
 });
 it("prunes blocked walk links and restores them when a panel opens",()=>{
  const socket=PG_PANEL_SOCKETS[0],base={...PG_MAP,navigation:[{id:0,position:socket.approaches[0],links:[{to:1,kind:"walk" as const}]},{id:1,position:socket.approaches[1],links:[{to:0,kind:"walk" as const}]}]};
  expect(pgCollisionMap(pgCreateCollisionSnapshot(),base).navigation[0].links).toEqual([]);
  expect(pgCollisionMap(pgCreateCollisionSnapshot(false),base).navigation).toEqual(base.navigation);
  expect(base.navigation[0].links).toHaveLength(1);
 });
 it("accepts complete snapshots monotonically and isolates accepted geometry",()=>{
  const first=pgCreateCollisionSnapshot(),next=pgCloneCollisionSnapshot(first);next.revision=2;next.panels[0].revision=2;next.panels[0].active=false;
  const accepted=pgAcceptCollisionSnapshot(first,next);
  expect(accepted).toEqual(next);expect(accepted).not.toBe(next);
  next.panels[0].solid.center.x=100;
  expect(accepted.panels[0].solid.center.x).toBe(-25);
  expect(pgAcceptCollisionSnapshot(accepted,first)).toBe(accepted);
  expect(pgAcceptCollisionSnapshot(accepted,accepted)).toBe(accepted);
  const regressed=pgCloneCollisionSnapshot(accepted);regressed.revision=3;regressed.panels[0].revision=1;
  expect(pgAcceptCollisionSnapshot(accepted,regressed)).toBe(accepted);
 });
});
