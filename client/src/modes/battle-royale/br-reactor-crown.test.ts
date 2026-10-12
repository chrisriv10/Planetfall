import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createBrReactorCrown} from "./br-reactor-crown";
function make(){const box=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),owned:THREE.BufferGeometry[]=[];const turbine=vi.fn(()=>new THREE.Group());return {...createBrReactorCrown("#ffd84d",{box,dark:material,metal:material,energy:material,orange:material,geometry:g=>{owned.push(g);return g;},makeTurbine:turbine}),box,material,owned,turbine};}
describe("Helios translucent containment projection",()=>{
 it("uses genuinely transparent additive planes, no solid wheels/core or extra light/animation",()=>{
  const r=make(),batches:THREE.InstancedMesh[]=[];r.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)batches.push(o);});
  expect(batches).toHaveLength(2);expect(r.turbine).not.toHaveBeenCalled();expect(r.animated).toHaveLength(0);
  expect(r.group.children.filter(o=>o instanceof THREE.PointLight)).toHaveLength(1);
  for(const b of batches){expect(b.geometry).toBe(r.owned[0]);expect(b.geometry.type).toBe("PlaneGeometry");const m=b.material as THREE.MeshBasicMaterial;expect(m.transparent).toBe(true);expect(m.depthWrite).toBe(false);expect(m.depthTest).toBe(true);expect(m.blending).toBe(THREE.AdditiveBlending);expect(m.opacity).toBeLessThan(.4);}
  expect(batches.reduce((n,b)=>n+b.count*2,0)).toBe(288);
  expect(r.group.children.some(o=>o.name.includes("orbit")||o.name.includes("core"))).toBe(false);
  r.disposers.forEach(d=>d());batches.forEach(b=>b.dispose());r.owned.forEach(g=>g.dispose());r.box.dispose();r.material.dispose();
 });
 it("centers every projected face above the roof emitter with bounded true instance geometry",()=>{
  const r=make();r.group.updateMatrixWorld(true);const boxes:THREE.Box3[]=[];
  r.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
   if(o instanceof THREE.InstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);boxes.push(o.geometry.boundingBox!.clone().applyMatrix4(m.premultiply(o.matrixWorld)));}}
   else boxes.push(new THREE.Box3().setFromObject(o));
  });
  for(const b of boxes){expect(b.min.y).toBeGreaterThanOrEqual(50.75);expect(Math.max(Math.abs(b.min.x-2.72),Math.abs(b.max.x-2.72),Math.abs(b.min.z+2.04),Math.abs(b.max.z+2.04))).toBeLessThan(8.6);}
  const base=new THREE.Box3().setFromObject(r.group.getObjectByName("helios-projector-base")!);
  expect(base.min.y+6.45).toBeCloseTo(57.2);
  const veil=r.group.getObjectByName("helios-hologram-veil")!;const b=new THREE.Box3().setFromObject(veil);expect(b.getCenter(new THREE.Vector3()).x).toBeCloseTo(2.72);expect(b.getCenter(new THREE.Vector3()).z).toBeCloseTo(-2.04);expect(b.min.y).toBeGreaterThan(52.5);
  const materials=r.group.children.filter(o=>o instanceof THREE.InstancedMesh).map(o=>(o as THREE.InstancedMesh).material as THREE.Material),spies=materials.map(m=>vi.spyOn(m,"dispose"));
  r.disposers.forEach(d=>{d();d();});spies.forEach(s=>expect(s).toHaveBeenCalledTimes(1));
  r.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});r.owned.forEach(g=>g.dispose());r.box.dispose();r.material.dispose();
 });
});
