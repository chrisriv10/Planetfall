import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {createPrCapacitorShatterBackdrop} from "./pr-capacitor-shatter-backdrop";

describe("research and final orbital backdrop",()=>{
 for(const id of ["capacitor-causeway","shatterdeck"] as const){
  it(`${id} preserves the course envelope throughout ambient motion`,()=>{
   const round=PR_ROUNDS.find(r=>r.id===id)!,art=createPrCapacitorShatterBackdrop(round);
   const protectedVolume=id==="shatterdeck"?new THREE.Box3(new THREE.Vector3(-35,-15,-35),new THREE.Vector3(35,40,35)):new THREE.Box3(new THREE.Vector3(-31,-25,-149),new THREE.Vector3(31,25,45));
   const matrix=new THREE.Matrix4(),bounds=new THREE.Box3();
   for(const ms of [0,10000,35000,90000]){
    art.update(ms);art.root.updateMatrixWorld(true);art.root.traverse(node=>{
     if(!(node instanceof THREE.InstancedMesh))return;
     expect(node.userData.cameraCollision).toBe(false);node.geometry.computeBoundingBox();
     for(let i=0;i<node.count;i++){
      node.getMatrixAt(i,matrix);matrix.premultiply(node.matrixWorld);expect(matrix.elements.every(Number.isFinite)).toBe(true);
      bounds.copy(node.geometry.boundingBox!).applyMatrix4(matrix);expect(bounds.intersectsBox(protectedVolume),node.userData.features[i].name).toBe(false);
     }
    });
   }art.dispose();
  });
  it(`${id} batches the skyline and scales details without losing the large world`,()=>{
   const art=createPrCapacitorShatterBackdrop(PR_ROUNDS.find(r=>r.id===id)!);let total=0;
   art.root.traverse(n=>{if(n instanceof THREE.Mesh)total++;});expect(total).toBeLessThanOrEqual(20);
   art.setQuality("low");let low=0;art.root.traverseVisible(n=>{if(n instanceof THREE.Mesh)low++;});expect(low).toBeGreaterThanOrEqual(5);expect(low).toBeLessThan(total);
   art.setQuality("high");let high=0;art.root.traverseVisible(n=>{if(n instanceof THREE.Mesh)high++;});expect(high).toBe(total);
   const scene=new THREE.Scene();scene.add(art.root);art.dispose();art.dispose();expect(scene.children).toHaveLength(0);expect(art.root.children).toHaveLength(0);
  });
 }
});
