import {expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {PG_BALANCE,pgCapsuleClear,pgPilotHit,pgCollisionMap,pgRayBox,type Vec3,type PgMap} from "@planetfall/shared";
import {PgZombieNavigation} from "../server/src/modes/planet-gun/pg-zombie-navigation";
export const state=(p:Page)=>p.evaluate(()=>(window as unknown as {__PLANETFALL_PG_DEBUG__:()=>any}).__PLANETFALL_PG_DEBUG__?.());
export function clear(a:Vec3,b:Vec3,map:PgMap,padding=0){const n=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(n<.01)return true;const direction={x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};return !map.solids.some(s=>{const t=pgRayBox(a,direction,padding?{...s,half:{x:s.half.x+padding,y:s.half.y,z:s.half.z+padding}}:s);return t!==null&&t<n-.05;});}
export function friendlyBlocks(a:Vec3,b:Vec3,s:any){const n=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(n<.01)return false;const direction={x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n};return s.remotePilots.some((p:any)=>p.hp>0&&p.team===s.local.team&&(pgPilotHit(a,direction,p.position,p.crouched??false)?.distance??Infinity)<n);}
export const pointerCoordinates=new WeakMap<Page,{x:number;y:number}>();
export async function moveMouse(page:Page,x:number,y:number,options?:{steps?:number}){await page.mouse.move(x,y,options);pointerCoordinates.set(page,{x,y});}
export async function captureRouteMouse(page:Page){
 if(await page.evaluate(()=>document.pointerLockElement?.id==="game-canvas"))return;
 await page.locator("#game-canvas").click({position:{x:480,y:270}});pointerCoordinates.set(page,{x:480,y:270});
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("game-canvas");
}
export async function lookAt(page:Page,target:Vec3){
 await page.mouse.up({button:"right"});await captureRouteMouse(page);
 const s=await state(page),p=s.local.position,eye=p.y+(s.local.crouched?PG_BALANCE.crouchEye:PG_BALANCE.eye),yaw=Math.atan2(p.x-target.x,p.z-target.z),pitch=Math.atan2(target.y-eye,Math.hypot(target.x-p.x,target.z-p.z));
 const pointer=pointerCoordinates.get(page)!,sensitivity=.0022*(s.ads>.5?.48:1),difference=Math.atan2(Math.sin(yaw-s.local.yaw),Math.cos(yaw-s.local.yaw));
 await moveMouse(page,pointer.x-difference/sensitivity,pointer.y-(pitch-s.local.pitch)/sensitivity);await page.waitForTimeout(100);
}
export async function go(page:Page,x:number,z:number){
 await page.bringToFront();await page.mouse.up({button:"right"});await captureRouteMouse(page);
 for(let i=0;i<70;i++){
  const observed=await state(page),s=observed.local,dx=x-s.position.x,dz=z-s.position.z,distance=Math.hypot(dx,dz);
  if(distance<.08&&Math.hypot(s.velocity.x,s.velocity.z)<.25){await page.keyboard.up("Control");return;}
  // Follow the validated straight corridor with ordinary mouse-look and W.
  // Quantizing a shallow corridor to cardinal WASD bursts cuts narrow corners.
  const desired=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw)),pointer=pointerCoordinates.get(page)??{x:480,y:270};
  await moveMouse(page,pointer.x-difference/(.0022*(observed.ads>.5?.48:1)),pointer.y);
  const near=distance<2;if(near)await page.keyboard.down("Control");else await page.keyboard.up("Control");
  await page.keyboard.down("w");try{await page.waitForTimeout(near?Math.max(18,Math.min(80,distance/2.5*500)):120);}finally{await page.keyboard.up("w");}
  await page.waitForTimeout(60);
 }
 throw Error(`Survival route blocked ${JSON.stringify((await state(page)).local.position)} -> ${x},${z}`);
}
export async function route(page:Page,target:Vec3,traceFile?:string){
 const trace:unknown[]=[];
 let s=await state(page);const map=pgCollisionMap(s.mode.collision),eye=(p:Vec3)=>({...p,y:p.y+.95}),metric=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 const nearest=(p:Vec3)=>[...map.navigation].sort((a,b)=>metric(a.position,p)-metric(b.position,p)).find(n=>clear(eye(p),eye(n.position),map,.43));
 if(!nearest(s.local.position)){
  // Live movement has rounded capsule corners; this route planner deliberately
  // inflates rectangular cover. Step away through ordinary input before
  // asking that conservative planner to connect a cover-hugging position.
  const p=s.local.position,exit=[[.65,0],[-.65,0],[0,.65],[0,-.65]].map(([x,z])=>({x:p.x+x,y:p.y,z:p.z+z})).find(v=>pgCapsuleClear(v,PG_BALANCE.height,map)&&clear(eye(p),eye(v),map)&&nearest(v));
  expect(exit,"No normal step away from the cover corner").toBeDefined();
  await go(page,exit!.x,exit!.z);s=await state(page);
 }
 const nav=new PgZombieNavigation(map);expect(nav.nearest(s.local.position)).not.toBeNull();expect(nav.nearest(target)).not.toBeNull();
 expect(nav.reachable(s.local.position,target),"No physically walkable route to station").toBe(true);
 for(let i=0;i<70;i++){
  const local=(await state(page)).local;if(metric(local.position,target)<.5)return;
  const destination=nav.destination(local.position,target);trace.push({position:{...local.position},destination:destination?{...destination}:null});expect(destination,"No capsule-supported next waypoint").not.toBeNull();await go(page,destination!.x,destination!.z);
 }
 if(traceFile)await writeFile(traceFile,JSON.stringify({target,trace,final:await state(page)},null,2));
 throw Error(`Survival route did not reach station: ${JSON.stringify((await state(page)).local.position)} -> ${JSON.stringify(target)}`);
}
