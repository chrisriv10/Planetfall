import {describe,it,expect} from "vitest";
import {PR_BALANCE as B,prRound,prSpawn,prStepMotion,prObstacleTransform,prObstacleCenter} from "./index.js";
const round=prRound("capacitor-causeway"),idle={sequence:1,moveX:0,moveZ:0,jump:false,dive:false};
const walk=(x:number,z:number,time:number,ticks=15)=>{const p=prSpawn({x,y:.6,z});p.grounded=true;for(let i=0;i<ticks;i++)prStepMotion(p,{...idle,sequence:i+1,moveZ:-1},1/B.tickRate,time+i*1000/B.tickRate,round,0);return p;};
describe("Capacitor Causeway authoritative circuit",()=>{
 it("has at least one full-width safe lane at every deterministic shutter phase",()=>{
  for(const seed of [0,1,42,996,91273])for(let ms=0;ms<24000;ms+=75)for(const z of [-20,-106]){
   const lanes=round.obstacles.filter(o=>o.kind==="shutter"&&o.center.z===z);expect(lanes).toHaveLength(3);expect(lanes.filter(o=>!prObstacleTransform(o,ms,seed).active)).toHaveLength(1);expect(lanes.reduce((sum,o)=>sum+o.half.x*2,0)).toBeGreaterThan(18);
  }
 });
 it("blocks closed lanes including former edge bypasses, while the open lane passes",()=>{
  // Seed zero at 2.64s opens the center and closes both outside lanes.
  for(const x of [-8.8,8.8])expect(walk(x,-18.7,2640).position.z).toBeGreaterThanOrEqual(-20+.65+B.radius-.001);
  expect(walk(0,-18.7,2640,20).position.z).toBeLessThan(-22);
 });
 it("telegraphs arcs before their bounded non-lethal contact impulse",()=>{
  const arc=round.obstacles.find(o=>o.kind==="arc")!;let warning=false,activeAt=-1;
  for(let ms=0;ms<10000;ms+=20){const state=prObstacleTransform(arc,ms,0);if(state.warning)warning=true;if(state.active&&warning){activeAt=ms;break;}}
  expect(activeAt).toBeGreaterThan(0);const p=prSpawn({x:arc.center.x,y:.6,z:arc.center.z});p.grounded=true;prStepMotion(p,idle,1/B.tickRate,activeAt,round,0);
  expect(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)).toBeGreaterThan(3);expect(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)).toBeLessThan(8);expect(p.position.y).toBeGreaterThan(round.killY);expect(Math.abs(p.position.x)).toBeLessThan(9);
 });
 it("makes the optional launch route materially faster than the normal route",()=>{
  const boosted=prSpawn({x:5.2,y:.6,z:-61}),normal=structuredClone(boosted),quiet={...round,obstacles:[]};boosted.grounded=normal.grounded=true;
  for(let i=0;i<18;i++){const input={...idle,moveZ:-1};prStepMotion(boosted,input,1/B.tickRate,5000+i*1000/B.tickRate,round,0);prStepMotion(normal,input,1/B.tickRate,5000+i*1000/B.tickRate,quiet,0);}
  expect(normal.position.z-boosted.position.z).toBeGreaterThan(4);expect(boosted.position.y).toBeGreaterThan(normal.position.y+1);expect(round.platforms.some(p=>p.id==="capacitor-boost-landing"&&p.half.x>=3)).toBe(true);
 });
 it("moves physical barrier contact with the exact shared visible center",()=>{
  const barrier=round.obstacles.find(o=>o.kind==="barrier")!,ms=1550,center=prObstacleCenter(barrier,ms,0);expect(center.x).toBeCloseTo(4.5);
  const p=walk(7.4,barrier.center.z+1.3,ms,8);expect(p.position.z).toBeGreaterThan(barrier.center.z+.65);expect(prObstacleCenter(barrier,ms,0)).toEqual(center);
 });
});
