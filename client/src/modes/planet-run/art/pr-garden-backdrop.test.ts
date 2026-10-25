import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {createPrGardenBackdrop} from "./pr-garden-backdrop";

const rounds=PR_ROUNDS.filter(r=>r.id==="meteor-garden"||r.id==="flux-gardens");
describe("orbital garden surroundings",()=>{
 it("keeps every instance beyond the protected route and limits batches",()=>{
  for(const round of rounds){
   const art=createPrGardenBackdrop(round),race=round.category==="race";
   const route=new THREE.Box3(new THREE.Vector3(race?-31:-38,-25,race?-149:-38),new THREE.Vector3(race?31:38,25,race?45:38));
   for(const time of [0,45000,130000]){
    art.update(time);art.root.updateMatrixWorld(true);let draws=0;
    art.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;draws++;expect(o.userData.cameraCollision).toBe(false);o.geometry.computeBoundingBox();
     if(o instanceof THREE.InstancedMesh){const matrix=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);expect(matrix.elements.every(Number.isFinite)).toBe(true);expect(o.geometry.boundingBox!.clone().applyMatrix4(matrix).intersectsBox(route)).toBe(false);}}
    });expect(draws).toBeLessThanOrEqual(18);
   }art.dispose();
  }
 });
 it("preserves a surrounding skyline on Low, bounds motion and releases resources once",()=>{
  for(const round of rounds){
   const art=createPrGardenBackdrop(round),resources=new Set<THREE.BufferGeometry|THREE.Material>();
   art.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});
   const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));art.setQuality("low");let low=0;art.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)low++;});expect(low).toBeGreaterThanOrEqual(10);
   art.setQuality("high");let high=0;art.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)high++;});expect(high).toBeGreaterThan(low);
   const shuttle=art.root.getObjectByName("habitat-service-shuttle")!;art.update(1000000);expect(shuttle.position.z).toBeGreaterThanOrEqual(-165);expect(shuttle.position.z).toBeLessThanOrEqual(25);
   art.dispose();art.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);expect(art.root.children).toHaveLength(0);
  }
 });
});
