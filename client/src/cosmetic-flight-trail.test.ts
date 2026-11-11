import {expect,it} from "vitest";
import * as THREE from "three";
import {createCosmeticFlightTrail,updateCosmeticFlightTrail,configureCosmeticFlightTrail} from "./cosmetic-flight-trail";

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

it("draws braided strands, radial petals and a broken wake in the existing bounded trail buffers",()=>{
  const line=createCosmeticFlightTrail("#70f5ff"),ribbon=line.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  const dots=line.children[1] as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  const points=Array.from({length:12},(_,i)=>new THREE.Vector3(0,0,i)),position=ribbon.geometry.getAttribute("position");
  const addresses=line.children.map(p=>(p as THREE.Mesh).material);
  for(const id of ["plasma-helix","solar-petals","void-wake","default"]){
    configureCosmeticFlightTrail(line,"#a880ff",id);updateCosmeticFlightTrail(line,points,4.5);
    expect(ribbon.geometry.getAttribute("position")).toBe(position);expect(line.children.map(p=>(p as THREE.Mesh).material)).toEqual(addresses);
    expect(line.geometry.getAttribute("position").getZ(5)).toBe(4.5);
    for(let i=0;i<ribbon.geometry.drawRange.count;i++){expect(position.getZ(i)).toBeLessThanOrEqual(4.5);expect(Number.isFinite(position.getX(i))).toBe(true);}
    if(id==="plasma-helix"){
      expect(position.getX(0)*position.getX(6)).toBeLessThan(0);expect(position.getY(1)).not.toBe(0);
      expect(ribbon.material.vertexColors).toBe(true);expect(dots.visible).toBe(false);
    }else if(id==="solar-petals"){
      expect(dots.material.userData.trailShape).toBe("petals");expect(dots.visible).toBe(true);
      const p=dots.geometry.getAttribute("position");expect(p.getX(2)).not.toBe(0);expect(p.getY(2)).not.toBe(0);expect(p.getZ(5)).toBe(4.5);
    }else if(id==="void-wake"){
      expect(line.material.opacity).toBe(0);expect(ribbon.geometry.drawRange.count).toBe(36);
      const shades=ribbon.geometry.getAttribute("color");
      for(const start of [0,6])expect(shades.getX(start)).toBeLessThan(shades.getX(start+2));
    }else{
      expect(ribbon.material.vertexColors).toBe(false);expect(ribbon.material.blending).toBe(THREE.AdditiveBlending);expect(line.material.opacity).toBe(.72);
    }
  }
  line.traverse(o=>{const mesh=o as THREE.Mesh;mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();});
});

it("keeps the dark Void Wake and its violet edge visible across horizontal and vertical views",()=>{
  const line=createCosmeticFlightTrail("#a880ff","void-wake");
  const ribbon=line.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  for(const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]){
    updateCosmeticFlightTrail(line,Array.from({length:12},(_,i)=>direction.clone().multiplyScalar(i)));
    const vertices=ribbon.geometry.getAttribute("position"),colors=ribbon.geometry.getAttribute("color");
    const triangle=(start:number)=>Array.from({length:3},(_,i)=>new THREE.Vector3().fromBufferAttribute(vertices,start+i));
    const [a,b,c]=triangle(0),[d,e,f]=triangle(6);
    const firstNormal=b.sub(a).cross(c.sub(a)).normalize();
    const secondNormal=e.sub(d).cross(f.sub(d)).normalize();
    expect(Math.abs(firstNormal.dot(secondNormal))).toBeLessThan(.01);
    for(const start of [0,6])expect(colors.getZ(start+2)).toBeGreaterThan(colors.getZ(start)*3);
  }
  line.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();});
});
