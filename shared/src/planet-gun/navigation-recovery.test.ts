import {describe,expect,it} from "vitest";
import {PG_MAP} from "./map.js";
import {pgSpawnMotion,pgStepMovement} from "./movement.js";
import {PG_TACTICAL_MOVEMENT_RULES} from "./movement-rules.js";
import {pgCollisionMap,pgCreateCollisionSnapshot} from "./mode-collision.js";
import type {Vec3} from "../index.js";

const corridor:Vec3[]=[{x:-38,y:0,z:-11},{x:-33.8,y:0,z:-11},{x:-33.8,y:0,z:-1.9},{x:-25,y:0,z:-3}];
const node=(p:Vec3)=>PG_MAP.navigation.find(n=>Math.hypot(n.position.x-p.x,n.position.y-p.y,n.position.z-p.z)<.01)!;
describe("west habitat ground corridor",()=>{
 it("starts the west stair from its real interior foot rather than through the front wall",()=>{
  const foot=node({x:-31,y:0,z:-1.9}),first=node({x:-31,y:.4,z:-3}),outside=node({x:-32,y:0,z:0});
  expect(foot.links).toContainEqual({to:first.id,kind:"walk"});expect(outside.links).not.toContainEqual({to:first.id,kind:"walk"});
  const p=pgSpawnMotion(corridor[1]);p.grounded=true;let tick=0;
  const points=[corridor[2],foot.position,...Array.from({length:9},(_,i)=>({x:-31,y:Math.min(3.5,.4+i*.4),z:-3-i*1.2})),{x:-31,y:3.5,z:-13},{x:-26,y:3.5,z:-13}];
  for(const goal of points){let arrived=false;
   for(let frame=0;frame<900;frame++){
    const dx=goal.x-p.position.x,dz=goal.z-p.position.z,d=Math.hypot(dx,dz);
    pgStepMovement(p,{sequence:++tick,moveX:0,moveZ:-Math.min(1,d/.5),yaw:Math.atan2(-dx,-dz),pitch:0,jump:false,sprint:false,crouch:false,ads:false},1/60,tick*1000/60,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);
    if(d<.06&&Math.abs(p.position.y-goal.y)<.05&&Math.hypot(p.velocity.x,p.velocity.z)<.6){arrived=true;break;}
   }
   expect(arrived,`stalled at ${JSON.stringify(p.position)} toward ${JSON.stringify(goal)}`).toBe(true);
  }
  expect(p.position.y).toBe(3.5);
 });
 it("joins all four authoritative perimeter barrier corners without a gap",()=>{
  const rails=PG_MAP.solids.filter(s=>s.kind==="rail");
  for(const z of [-37.5,37.5])for(const x of [-45.5,45.5]){
   const horizontal=rails.find(s=>s.center.z===z)!,vertical=rails.find(s=>s.center.x===x)!;
   expect(horizontal.half.x).toBeGreaterThanOrEqual(Math.abs(vertical.center.x)+vertical.half.x);
   expect(Math.abs(horizontal.center.z)-horizontal.half.z).toBeLessThan(vertical.half.z);
  }
 });
 it("connects the actual doorway around the stair flight",()=>{
  for(let i=1;i<corridor.length;i++){
   expect(node(corridor[i-1]).links).toContainEqual({to:node(corridor[i]).id,kind:"walk"});
   expect(node(corridor[i]).links).toContainEqual({to:node(corridor[i-1]).id,kind:"walk"});
  }
  expect(node(corridor[2]).links).not.toContainEqual({to:node({x:-32,y:0,z:0}).id,kind:"walk"});
 });
 for(const reverse of [false,true])it(`physically walks the entire corridor ${reverse?"outward":"inward"} under tactical rules`,()=>{
  const points=reverse?[...corridor].reverse():corridor,p=pgSpawnMotion(points[0]);p.grounded=true;let tick=0,maxHeight=0;
  for(const goal of points.slice(1)){
   let arrived=false;
   for(let frame=0;frame<900;frame++){
    const dx=goal.x-p.position.x,dz=goal.z-p.position.z,d=Math.hypot(dx,dz);
    pgStepMovement(p,{sequence:++tick,moveX:0,moveZ:-Math.min(1,d/.5),yaw:Math.atan2(-dx,-dz),pitch:0,jump:false,sprint:false,crouch:false,ads:false},1/60,tick*1000/60,PG_MAP,PG_TACTICAL_MOVEMENT_RULES);
    maxHeight=Math.max(maxHeight,p.position.y);
    if(d<.06&&Math.hypot(p.velocity.x,p.velocity.z)<.6){arrived=true;break;}
   }
   expect(arrived,`stalled at ${JSON.stringify(p.position)} toward ${JSON.stringify(goal)}`).toBe(true);
  }
  expect(maxHeight).toBeCloseTo(.4);expect(p.position.y).toBe(0);
 });
 it("closes only the doorway edge for an active panel and restores it on breach",()=>{
  const snapshot=pgCreateCollisionSnapshot(false),door=snapshot.panels.find(p=>p.id==="west-end")!;door.active=true;
  const outside=node(corridor[0]).id,inside=node(corridor[1]).id;
  const closed=pgCollisionMap(snapshot);expect(closed.navigation[outside].links.some(l=>l.to===inside)).toBe(false);
  expect(closed.navigation[inside].links).toContainEqual({to:node(corridor[2]).id,kind:"walk"});
  door.active=false;expect(pgCollisionMap(snapshot).navigation[outside].links).toContainEqual({to:inside,kind:"walk"});
 });
});
