import {describe,it,expect} from "vitest";
import {PG_MAP} from "./map.js";
import {PG_BALANCE as B} from "./balance.js";
import {pgCapsuleClear,pgSpawnMotion,pgStepMovement} from "./movement.js";
import {pgRayBox} from "./math.js";
import type {PgInput} from "./types.js";
const walk:PgInput={sequence:0,moveX:0,moveZ:1,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,ads:false};
describe("Nova neighborhood physical routes",()=>{
 it("routes bots across supported gallery landings and through the suite doorway",()=>{
  for(const [start,end]of [[[-31,3.5,-12.6],[-25,3.5,-15]],[[32,3.5,15.6],[28,3.5,23]]]){
   const node=(p:number[])=>PG_MAP.navigation.find(n=>Math.hypot(n.position.x-p[0],n.position.y-p[1],n.position.z-p[2])<.001)!;
   const from=node(start),to=node(end),queue=[from.id],previous=new Map<number,number>([[from.id,-1]]);
   for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to.id)break;for(const link of PG_MAP.navigation[id].links)if(!previous.has(link.to)){previous.set(link.to,id);queue.push(link.to);}}
   expect(previous.has(to.id)).toBe(true);const path=[to.id];while(path[0]!==from.id)path.unshift(previous.get(path[0])!);
   const p=pgSpawnMotion(from.position);p.grounded=true;let tick=0;
   for(const id of path.slice(1)){
    const target=PG_MAP.navigation[id].position;let arrived=false;
    for(let i=0;i<240;i++){
     const dx=target.x-p.position.x,dz=target.z-p.position.z,d=Math.hypot(dx,dz);if(d<.08&&Math.hypot(p.velocity.x,p.velocity.z)<.1){arrived=true;break;}
     const scale=Math.max(.5,d);pgStepMovement(p,{...walk,moveX:Math.max(-1,Math.min(1,dx/scale)),moveZ:Math.max(-1,Math.min(1,dz/scale)),sequence:tick},1/60,tick++*1000/60);
     expect(pgCapsuleClear(p.position,B.height),`Gallery collision ${JSON.stringify(p.position)}`).toBe(true);
     expect(p.position.y,`Unsupported gallery link ${JSON.stringify(target)}`).toBeCloseTo(3.5);
    }
    expect(arrived,`Unreachable gallery node ${JSON.stringify(target)} from ${JSON.stringify(p.position)}`).toBe(true);
   }
  }
 });
 it("connects the observatory landing to its upper room around the stairwell",()=>{
  const p=pgSpawnMotion({x:32,y:3.5,z:17.7});p.grounded=true;
  for(const [moveX,moveZ,ticks]of [[0,1,32],[-1,0,50],[0,1,30]])for(let i=0;i<ticks;i++){
   pgStepMovement(p,{...walk,moveX,moveZ,crouch:true},1/60,i*1000/60);expect(p.position.y).toBeCloseTo(3.5);
  }
  expect(p.position.x).toBeLessThan(30);expect(p.position.z).toBeGreaterThan(20);
 });
 it("climbs every stair flight slowly while crouched and strafing",()=>{
  for(const [x,z,direction,ticks]of [[-31,-2,-1,230],[32,4,1,250],[15.6,16,1,160],[-12,-29.4,1,130]]){
   const p=pgSpawnMotion({x,y:0,z},-Math.PI/2);p.grounded=true;
   for(let i=0;i<ticks;i++)pgStepMovement(p,{...walk,sequence:i,moveX:direction,moveZ:0,yaw:-Math.PI/2,crouch:true},1/60,i*1000/60);
   expect(p.position.y,JSON.stringify(p.position)).toBeCloseTo(x===-12?1.2:3.5);expect(p.grounded).toBe(true);
   expect((p.position.z-z)*direction).toBeGreaterThan(x===-12?5:x===15.6?8:x===-31?11:12);
  }
 });
 it("walks the garden terrace and engineering stairs with full standing headroom",()=>{
  for(const [x,z,ticks,height]of [[-12,-29.8,55,1.2],[15.6,16,100,3.5]]){
   const p=pgSpawnMotion({x,y:0,z});p.grounded=true;
   for(let i=0;i<ticks;i++){pgStepMovement(p,{...walk,sequence:i},1/60,i*1000/60);expect(pgCapsuleClear(p.position,B.height),JSON.stringify(p.position)).toBe(true);}
   expect(p.position.y).toBeCloseTo(height);expect(p.grounded).toBe(true);expect(p.position.z).toBeGreaterThan(z+5);
  }
 });
 it("keeps authored spawns and both original stair approaches collision clear",()=>{
  for(const s of PG_MAP.spawns)expect(pgCapsuleClear(s.position,B.height)).toBe(true);
  for(const [x,z]of [[-31,-1.8],[32,4],[-25,.5],[19,15],[35,15]])expect(pgCapsuleClear({x,y:0,z},B.height),`Approach ${x},${z}`).toBe(true);
 });
 it("keeps the opposing-client southern passage clear for scoped combat",()=>{
  const from={x:-12,y:1.57,z:15.6},direction={x:1,y:0,z:0};
  for(const s of PG_MAP.solids){const hit=pgRayBox(from,direction,s);expect(hit===null||hit>=24,`Unexpected firing obstruction ${s.id}`).toBe(true);}
 });
 it("backs tree trunks and cover with authority while raised navigation has support",()=>{
  const trees=PG_MAP.solids.filter(s=>s.kind==="tree");expect(trees).toHaveLength(4);
  for(const t of trees){expect(t.half.y*2).toBeGreaterThan(B.height*3);expect(pgCapsuleClear({x:t.center.x,y:t.center.y,z:t.center.z},B.height)).toBe(false);expect(pgRayBox({x:t.center.x-3,y:t.center.y,z:t.center.z},{x:1,y:0,z:0},t)).toBeCloseTo(3-t.half.x);}
  for(const route of[{x:-12,y:1.2,z:-24},{x:15.6,y:3.5,z:27}]){
   const n=PG_MAP.navigation.find(n=>n.position.x===route.x&&n.position.y===route.y&&n.position.z===route.z);expect(n).toBeDefined();expect(n!.links.length).toBeGreaterThan(0);expect(pgCapsuleClear(route,B.height)).toBe(true);
   expect(PG_MAP.solids.some(s=>Math.abs(s.center.x-route.x)<=s.half.x&&Math.abs(s.center.z-route.z)<=s.half.z&&Math.abs(s.center.y+s.half.y-route.y)<.001)).toBe(true);
  }
 });
 it("routes the garden approach inside the hydro wall and supports the entry canopy",()=>{
  const base=PG_MAP.navigation.find(n=>n.position.x===-12&&n.position.y===0&&n.position.z===-29.4)!;
  const approach=PG_MAP.navigation.find(n=>n.position.x===-5.9&&n.position.y===0&&n.position.z===-29.4)!;
  const first=PG_MAP.navigation.find(n=>n.position.x===-12&&n.position.y===.3&&n.position.z===-28.1)!;
  expect(base).toBeDefined();expect(approach).toBeDefined();expect(first).toBeDefined();expect(base.links.some(l=>l.to===approach.id&&l.kind==="walk")).toBe(true);expect(first.links.some(l=>l.to===base.id&&l.kind==="walk")).toBe(true);
  const canopy=PG_MAP.solids.find(s=>s.id==="nova-entry-canopy")!;
  for(const id of["nova-canopy-bearing-west","nova-canopy-bearing-east"]){const bearing=PG_MAP.solids.find(s=>s.id===id)!;expect(bearing.center.y+bearing.half.y).toBeCloseTo(canopy.center.y-canopy.half.y);expect(bearing.center.y-bearing.half.y).toBeCloseTo(3.2);}
  const p=pgSpawnMotion({x:-5.9,y:0,z:-29.4});p.grounded=true;
  for(let i=0;i<80;i++)pgStepMovement(p,{...walk,sequence:i},1/60,i*1000/60);
  expect(p.position.z).toBeGreaterThan(-21);expect(p.position.y).toBe(0);expect(pgCapsuleClear(p.position,B.height)).toBe(true);
 });
});
