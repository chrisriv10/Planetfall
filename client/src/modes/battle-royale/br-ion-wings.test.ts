import { describe,expect,it } from "vitest";
import * as THREE from "three";
import { createBrIonWings } from "./br-ion-wings";

describe("BR Ion Wings visual rig",()=>{
  it("builds one shared backpack silhouette with four articulated energy panels",()=>{
    const wings=createBrIonWings("#70f5ff");
    const names:string[]=[];wings.traverse(object=>names.push(object.name));
    expect(wings.visible).toBe(false);
    expect(names.filter(name=>name==="ion-pack")).toHaveLength(1);
    expect(names.filter(name=>name==="ion-core")).toHaveLength(1);
    expect(names.filter(name=>name==="ion-wing-upper")).toHaveLength(2);
    expect(names.filter(name=>name==="ion-wing-lower")).toHaveLength(2);
    expect(names.filter(name=>name==="ion-emitter-arm")).toHaveLength(4);
    expect(names.filter(name=>name==="ion-emitter")).toHaveLength(4);
    expect(names.filter(name=>name==="ion-trail-nozzle")).toHaveLength(2);
    const bounds=new THREE.Box3().setFromObject(wings);
    expect(bounds.max.x-bounds.min.x).toBeGreaterThan(3);
    expect(bounds.max.y-bounds.min.y).toBeGreaterThan(1.2);
    expect([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
  });
  it("keeps translucent energy surfaces non-writing for clean layered blending",()=>{
    const wings=createBrIonWings(0xff66cc);const energy:THREE.MeshBasicMaterial[]=[];
    wings.traverse(object=>{if(object instanceof THREE.Mesh&&object.material instanceof THREE.MeshBasicMaterial&&object.material.transparent)energy.push(object.material);});
    expect(energy.length).toBeGreaterThan(4);
    for(const material of energy){expect(material.depthWrite).toBe(false);expect(material.toneMapped).toBe(false);}
  });
});
