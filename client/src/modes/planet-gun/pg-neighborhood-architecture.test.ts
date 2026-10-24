import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PG_MAP } from "@planetfall/shared";
import { buildPgNeighborhoodArchitecture } from "./pg-neighborhood-architecture";
import type { PgArtMaterial, PgArtPlacement, PgArtPrimitive } from "./pg-environment-builder";

type Feature={name:string;primitive:PgArtPrimitive;material:PgArtMaterial;p:PgArtPlacement;r:readonly[number,number,number];detail:boolean};
function features(){const result:Feature[]=[];buildPgNeighborhoodArchitecture({add(name,primitive,material,p,r=[0,0,0],detail=false){result.push({name,primitive,material,p,r,detail});}});return result;}
const overlaps=(a:PgArtPlacement,b:PgArtPlacement)=>[0,1,2].every(i=>Math.abs(a[i]-b[i])<(a[i+3]+b[i+3])/2-1e-6);
describe("collision-backed neighborhood architecture",()=>{
 it("keeps new upholstered furniture and fixtures within four centimetres of real cover",()=>{
   const ids=["nova-lounge-seat","nova-lounge-back","nova-suite-table","ion-repair-bench","ion-control-console","ion-diagnostic-rack"];
   const geometry={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,7),torus:new THREE.TorusGeometry(1,.045,4,32)};
   const dummy=new THREE.Object3D();
   try{for(const f of features().filter(f=>ids.includes(f.name.split(":")[0]))){
     const s=PG_MAP.solids.find(s=>s.id===f.name.split(":")[0])!;
     const g=geometry[f.primitive as keyof typeof geometry];g.computeBoundingBox();
     dummy.position.set(f.p[0],f.p[1],f.p[2]);dummy.scale.set(f.p[3],f.p[4],f.p[5]);dummy.rotation.set(...f.r);dummy.updateMatrix();
     const bounds=g.boundingBox!.clone().applyMatrix4(dummy.matrix);
     for(const axis of["x","y","z"]as const){expect(bounds.min[axis],f.name).toBeGreaterThanOrEqual(s.center[axis]-s.half[axis]-.04001);expect(bounds.max[axis],f.name).toBeLessThanOrEqual(s.center[axis]+s.half[axis]+.04001);}
   }}finally{Object.values(geometry).forEach(g=>g.dispose());}
 });
 it("keeps both habitat doors and both upper service approaches clear",()=>{
   const paths:PgArtPlacement[]=[[-25,1.55,-1,3.8,3.05,1],[-26,4.85,-13.7,4.8,2.65,.8],[13.25,4.8,27,1,2.5,3.8],[15.6,4.8,23.5,3.8,2.5,.8]];
   for(const f of features().filter(f=>f.primitive==="box"))for(const gate of paths)expect(overlaps(f.p,gate),`${f.name} obstructs a real entrance`).toBe(false);
 });
 it("backs every facade with its own solid and bounds projection to five centimetres",()=>{
   for(const f of features().filter(f=>f.name.includes(":window")||f.name.endsWith(":vent"))){
     const s=PG_MAP.solids.find(s=>s.id===f.name.split(":")[0])!;expect(s).toBeDefined();
     const normal=f.p[3]<.02?0:2,along=normal===0?2:0;
     const centers=[s.center.x,s.center.y,s.center.z],halves=[s.half.x,s.half.y,s.half.z];
     expect(Math.abs(f.p[normal]-centers[normal])+f.p[normal+3]/2-halves[normal]).toBeLessThanOrEqual(.051);
     expect(Math.abs(f.p[along]-centers[along])+f.p[along+3]/2).toBeLessThanOrEqual(halves[along]+.001);
     expect(Math.abs(f.p[1]-s.center.y)+f.p[4]/2).toBeLessThanOrEqual(s.half.y+.001);
   }
 });
 it("keeps meaningful architecture on Low and uses a bounded batch palette",()=>{
   const all=features(),batches=new Set(all.map(f=>`${f.primitive}:${f.material}:${f.detail}`));
   expect(batches.size).toBeLessThanOrEqual(10);
   for(const prefix of["nova-roof","nova-canopy","ion-gallery","ion-control","ion-tower","relay-cap","relay-soffit"])
     expect(all.some(f=>f.name.startsWith(prefix)&&!f.detail)).toBe(true);
   for(const f of all){expect(f.p.every(Number.isFinite)).toBe(true);expect(f.p.slice(3).every(n=>n>0)).toBe(true);}
 });
 it("keeps furniture within real console footprints and keeps run face projection under four centimetres",()=>{
   for(const f of features()){
     if(f.name.includes(":work-surface")||f.name.includes(":touch-display")||f.name.includes(":display-row")){
       const s=PG_MAP.solids.find(s=>s.id===f.name.split(":")[0])!;
       expect(Math.abs(f.p[0]-s.center.x)+f.p[3]/2).toBeLessThanOrEqual(s.half.x);
       expect(Math.abs(f.p[2]-s.center.z)+f.p[5]/2).toBeLessThanOrEqual(s.half.z);
       expect(f.p[1]+f.p[4]/2-(s.center.y+s.half.y)).toBeLessThan(.03);
     }
     if(f.primitive==="box")expect(overlaps(f.p,[12.56,1.5,25,.1,3,15.8]),f.name).toBe(false);
   }
 });
});
