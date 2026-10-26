import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPgViewmodel} from "./pg-viewmodel";
import {createPgBeveledHousingGeometry,createPgSculptedHousingGeometry} from "./pg-weapon-presentation";
describe("PlanetGun local rear housing refinement",()=>{
 it("sculpts a narrow lowered rear face while preserving the front shoulder and finite outward normals",()=>{
  const g=createPgSculptedHousingGeometry(),p=g.getAttribute("position"),n=g.getAttribute("normal"),rear=new THREE.Box3();
  expect(p.count/3).toBe(60);
  for(let i=0;i<p.count;i++){
   const point=new THREE.Vector3().fromBufferAttribute(p,i),normal=new THREE.Vector3().fromBufferAttribute(n,i);
   expect(normal.length()).toBeCloseTo(1,5);expect(normal.dot(point)).toBeGreaterThan(0);
   if(point.z>.499)rear.expandByPoint(point);
  }
  expect(rear.max.x-rear.min.x).toBeCloseTo(.48,6);expect(rear.max.y).toBeCloseTo(.22,6);
  expect((rear.max.x-rear.min.x)*(rear.max.y-rear.min.y)).toBeLessThan(.32);g.dispose();
 });
 it("replaces Photon and Pulse slabs with narrower dark stocks without moving their canonical muzzle or pump",()=>{
  const vm=createPgViewmodel();
  for(const [weapon,oldZ,maxWidth,muzzle]of [["photon",.18,.25,[0,.03,-1.6]],["pulse",.15,.21,[0,.02,-1.9]]]as const){
   const core=vm.root.getObjectByName(`pg-${weapon}-stock-core`)as THREE.Mesh,model=core.parent!;
   expect(core.scale.x).toBeLessThan(maxWidth);expect(core.scale.y).toBeLessThan(.15);
   expect((core.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x415668);
   expect(model.children.find(o=>o.position.z===oldZ&&o.position.y===.02&&o.position.x===0)!.visible).toBe(false);
   expect(model.userData.muzzle.toArray()).toEqual(muzzle);
   if(weapon==="photon")expect(model.getObjectByName("shotgun-pump")!.position.toArray()).toEqual([0,-.13,-1.12]);
  }
  vm.dispose();
 });
 it("uses a bounded low-poly chamfer with finite outward-facing normals",()=>{
  const g=createPgBeveledHousingGeometry();g.computeBoundingBox();expect(g.getAttribute("position").count/3).toBe(60);expect(g.boundingBox!.min.toArray()).toEqual([-.5,-.5,-.5]);expect(g.boundingBox!.max.toArray()).toEqual([.5,.5,.5]);
  const p=g.getAttribute("position"),n=g.getAttribute("normal");for(let i=0;i<p.count;i++){const normal=new THREE.Vector3().fromBufferAttribute(n,i),point=new THREE.Vector3().fromBufferAttribute(p,i);expect(normal.length()).toBeCloseTo(1,5);expect(normal.dot(point)).toBeGreaterThan(0);}g.dispose();
 });
 it("replaces the camera-facing Helix slab with a shorter narrow stock and separate recoil pad",()=>{
  const vm=createPgViewmodel(),core=vm.root.getObjectByName("pg-helix-stock-core")as THREE.Mesh;
  expect(core.scale.x).toBeLessThan(.23);expect(core.scale.y).toBeLessThan(.2);expect(core.position.z+core.scale.z/2).toBeLessThan(.30);
  const model=core.parent!,old=model.children.find(o=>o instanceof THREE.Mesh&&o.position.y===.02&&o.position.z===.2&&o.position.x===0)!;expect(old.visible).toBe(false);
  expect(model.getObjectByName("stock-recoil-pad")).toBeDefined();expect(model.getObjectByName("stock-cheek-inlay")).toBeDefined();
  expect((core.material as THREE.MeshStandardMaterial).color.getHex()).not.toBe(0xa4b6c6);vm.dispose();
 });
 it("shares one bevel resource across local weapons and disposes it once",()=>{
  const vm=createPgViewmodel(),helix=vm.root.getObjectByName("pg-helix-stock-core")as THREE.Mesh,arc=vm.root.getObjectByName("pg-arc-stock-core")as THREE.Mesh,prism=vm.root.getObjectByName("pg-prism-stock-core")as THREE.Mesh,orbit=vm.root.getObjectByName("orbit-light-slide")as THREE.Mesh;
  expect(arc.geometry).toBe(helix.geometry);expect(prism.geometry).toBe(helix.geometry);expect(orbit.geometry).toBe(helix.geometry);const dispose=vi.spyOn(helix.geometry,"dispose");vm.dispose();vm.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
});
