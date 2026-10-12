import {expect,it} from "vitest";
import * as THREE from "three";
import {createCosmeticFlightTrail,updateCosmeticFlightTrail} from "./cosmetic-flight-trail";

it("clips the local trail before the following camera without stretching it or changing the remote trail",()=>{
  const trail=createCosmeticFlightTrail("cyan");
  const points=Array.from({length:12},(_,i)=>new THREE.Vector3(100,80,i*2));
  updateCosmeticFlightTrail(trail,points,5);
  const position=trail.geometry.getAttribute("position");
  expect(trail.geometry.drawRange.count).toBe(4);
  expect(position.getZ(3)).toBe(5);
  expect((trail.children[0] as THREE.Mesh).geometry.drawRange.count).toBe(36);
  for(const child of trail.children){
    const geometry=(child as THREE.Mesh).geometry,attribute=geometry.getAttribute("position");
    for(let i=0;i<geometry.drawRange.count;i++)expect(Math.abs(attribute.getZ(i))).toBeLessThanOrEqual(5.1);
  }
  updateCosmeticFlightTrail(trail,points);
  expect(trail.geometry.drawRange.count).toBe(12);expect(position.getZ(11)).toBe(22);
  for(const path of [points.map(()=>new THREE.Vector3(0,0,0)),points.map((_,i)=>new THREE.Vector3(0,i,0)),[]]){
    updateCosmeticFlightTrail(trail,path);
    for(const object of [trail,...trail.children]){
      const geometry=(object as THREE.Mesh).geometry;
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    }
  }
  trail.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();});
});
