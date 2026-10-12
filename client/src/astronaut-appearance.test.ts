import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "./astronaut";
describe("canonical astronaut digital eyes",()=>{
 const eyeAt=(rig:ReturnType<typeof createAstronautVisual>,index:number)=>{const eyes=rig.helmet.getObjectByName("astronaut-eyes") as THREE.InstancedMesh,m=new THREE.Matrix4(),eye=new THREE.Mesh(eyes.geometry,eyes.material);eyes.getMatrixAt(index,m);m.decompose(eye.position,eye.quaternion,eye.scale);return eye;};
 const create=()=>createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
 it("keeps the existing shell and visor geometry, material and bind transforms",()=>{
  const rig=create(),shell=rig.helmet.children[0] as THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>;
  expect(shell.geometry.parameters.radius).toBe(.56);expect(shell.geometry.parameters.widthSegments).toBe(12);expect(shell.geometry.parameters.heightSegments).toBe(9);
  expect(shell.scale.toArray()).toEqual([1.02,.98,.98]);expect(shell.material.color.getHex()).toBe(0xf0f6ff);
  expect(rig.visor.position.toArray()).toEqual([0,.02,.31]);expect(rig.visor.scale.toArray()).toEqual([.98,.74,.42]);
  expect(rig.visor.material.color.getHex()).toBe(0x102344);expect(rig.visor.material.metalness).toBe(.82);expect(rig.visor.material.roughness).toBe(.12);expect(rig.visor.material.emissiveIntensity).toBe(.6);
  expect(rig.helmet.position.toArray()).toEqual([0,1.46,0]);expect(rig.torso.position.toArray()).toEqual([0,.72,0]);
 });
 it("uses two symmetric black vertical eyes with normal depth occlusion",()=>{
  const rig=create(),left=eyeAt(rig,0),right=eyeAt(rig,1);
  expect(left.geometry).toBe(right.geometry);expect(left.material).toBe(right.material);
  expect(left.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  expect((left.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x000000);
  expect(left.position.x).toBe(-right.position.x);expect(left.position.y).toBeCloseTo(.025);expect(left.position.z).toBe(right.position.z);
  expect(left.scale.y).toBeGreaterThan(left.scale.x);expect(left.rotation.y).toBe(-right.rotation.y);
  expect(left.material).toHaveProperty("depthTest",true);expect(left.material).toHaveProperty("depthWrite",true);
  expect(rig.lodDetails).not.toContain(rig.helmet.getObjectByName("astronaut-eyes"));
 });
 it("fits the visible eye centers to the actual faceted shell without extending its silhouette",()=>{
  const rig=create(),shell=rig.helmet.children[0] as THREE.Mesh;
  rig.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),front=new THREE.Vector3(0,0,-1),origin=new THREE.Vector3();
  for(const index of [0,1]){
   const eye=eyeAt(rig,index);rig.helmet.add(eye);rig.group.updateMatrixWorld(true);
   origin.set(eye.position.x,eye.position.y+rig.helmet.position.y,2);ray.set(origin,front);
   const shellHit=ray.intersectObject(shell)[0],eyeHit=ray.intersectObject(eye)[0];
   expect(shellHit).toBeDefined();expect(eyeHit).toBeDefined();
   expect(eyeHit.distance).toBeLessThan(shellHit.distance);
   expect(shellHit.distance-eyeHit.distance).toBeLessThan(.015);
   const box=new THREE.Box3().setFromObject(eye);expect(box.max.z).toBeLessThan(.56*.98);
  }
 });
});
