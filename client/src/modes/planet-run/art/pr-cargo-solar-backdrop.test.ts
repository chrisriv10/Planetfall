import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {createPrCargoSolarBackdrop} from "./pr-cargo-solar-backdrop";

describe("freight and power orbital districts",()=>{
 for(const id of ["cargo-cyclone","solar-sweep"] as const)it(`${id} stays outside play space through its motion cycle within twenty draws`,()=>{
  const round=PR_ROUNDS.find(r=>r.id===id)!,b=createPrCargoSolarBackdrop(round);
  const protectedBox=id==="cargo-cyclone"?new THREE.Box3(new THREE.Vector3(-31,-25,-149),new THREE.Vector3(31,25,45)):new THREE.Box3(new THREE.Vector3(-38,-20,-38),new THREE.Vector3(38,25,38));
  const transform=new THREE.Matrix4(),bounds=new THREE.Box3();let draws=0;
  b.root.traverse(o=>{if(o instanceof THREE.Mesh)draws++;});expect(draws).toBeLessThanOrEqual(20);
  for(const time of [0,15000,55000,125000,300000]){
   b.update(time);b.root.updateMatrixWorld(true);
   b.root.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;
    expect(o.userData.cameraCollision).toBe(false);o.geometry.computeBoundingBox();
    for(let i=0;i<o.count;i++){
     o.getMatrixAt(i,transform);transform.premultiply(o.matrixWorld);
     expect(transform.elements.every(Number.isFinite)).toBe(true);
     bounds.copy(o.geometry.boundingBox!).applyMatrix4(transform);
     expect(bounds.intersectsBox(protectedBox),`${id}: ${o.userData.features[i].name}`).toBe(false);
    }
   });
  }
  b.setQuality("low");let low=0;b.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)low++;});expect(low).toBeGreaterThan(5);expect(low).toBeLessThan(draws);
  b.setQuality("high");let high=0;b.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)high++;});expect(high).toBe(draws);
  b.dispose();
 });
 it("owns and releases resources exactly once",()=>{
  const b=createPrCargoSolarBackdrop(PR_ROUNDS.find(r=>r.id==="cargo-cyclone")!),resources=new Set<THREE.BufferGeometry|THREE.Material>();
  b.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])resources.add(material);}});
  const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));b.dispose();b.dispose();b.update(9000);b.setQuality("high");
  expect(b.root.children).toHaveLength(0);for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
 });
});
