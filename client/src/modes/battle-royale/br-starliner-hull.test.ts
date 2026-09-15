import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createStarlinerHull, createStarlinerWing } from "./br-starliner-hull";
import { createStarliner } from "./br-presentation";

describe("Starliner authored visual shell",()=>{
  it("tapers engine plumes aft instead of expanding into opaque wedges",()=>{
    const ship=createStarliner();const plumes=ship.children.filter(child=>child.userData.engineTrail) as THREE.Mesh<THREE.ConeGeometry,THREE.MeshBasicMaterial>[];
    expect(plumes).toHaveLength(3);
    for(const plume of plumes){
      expect(new THREE.Vector3(0,1,0).applyQuaternion(plume.quaternion).z).toBeCloseTo(1);
      expect(plume.material.opacity).toBeLessThanOrEqual(.32);
    }
    const center=plumes.find(plume=>plume.position.x===0)!;
    expect(center.position.z-center.geometry.parameters.height/2).toBeGreaterThan(28);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    ship.traverse(child=>{if(child instanceof THREE.Mesh){geometries.add(child.geometry);for(const material of Array.isArray(child.material)?child.material:[child.material])materials.add(material);}});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
  });
  it("fits the original transport envelope with finite outward-facing closed hull panels",()=>{
    const geometry=createStarlinerHull();const position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
    expect(geometry.boundingBox!.min.z).toBe(-34);expect(geometry.boundingBox!.max.z).toBe(28);
    expect(geometry.boundingBox!.max.x).toBe(9.5);expect(geometry.boundingBox!.max.y).toBe(8);
    expect(position.count/3).toBe(96);
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
    for(let i=0;i<position.count;i+=3){
      a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);
      n.fromBufferAttribute(normal,i);expect(n.length()).toBeCloseTo(1);
      const centroid=a.add(b).add(c).multiplyScalar(1/3);
      expect(n.dot(centroid)).toBeGreaterThan(0);
    }
    expect(geometry.groups).toHaveLength(3);
    expect(geometry.groups.map(g=>g.materialIndex)).toEqual([0,1,2]);
    expect(geometry.groups.reduce((sum,g)=>sum+g.count,0)).toBe(position.count);geometry.dispose();
  });
  it("provides a thin swept wing instead of a rectangular slab",()=>{
    const geometry=createStarlinerWing();geometry.computeBoundingBox();
    const size=geometry.boundingBox!.getSize(new THREE.Vector3())!;
    expect(size.x).toBeCloseTo(20);expect(size.y).toBeCloseTo(1.1);expect(size.z).toBeCloseTo(29);
    expect([...geometry.getAttribute("position").array].every(Number.isFinite)).toBe(true);geometry.dispose();
  });
});
