import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {createPrSkyArt} from "./pr-sky-art";

describe("parameterized PlanetRun sky",()=>{
 it("keeps each round distinct, finite and within ten draws",()=>{
  const compositions=new Set<string>();
  for(const round of PR_ROUNDS){
   const sky=createPrSkyArt(round);sky.update(173000);let draws=0;
   sky.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){draws++;for(const value of o.geometry.getAttribute("position").array)expect(Number.isFinite(value)).toBe(true);if(o instanceof THREE.InstancedMesh)for(const value of o.instanceMatrix.array)expect(Number.isFinite(value)).toBe(true);}});
   expect(draws).toBeLessThanOrEqual(10);const planet=sky.root.getObjectByName("distant-band-planet") as THREE.Mesh;expect(planet.position.length()-planet.scale.x).toBeGreaterThan(250);
   compositions.add(`${planet.position.toArray()}:${planet.scale.x}`);
   expect((planet.material as THREE.MeshBasicMaterial).map?.magFilter).toBe(THREE.LinearFilter);
   const station=sky.root.children.find(o=>o.name.endsWith("-station")) as THREE.InstancedMesh,matrix=new THREE.Matrix4();
   for(let i=0;i<station.count;i++){station.getMatrixAt(i,matrix);expect(new THREE.Vector3().setFromMatrixPosition(matrix).length()).toBeGreaterThan(300);}
   sky.dispose();
  }expect(compositions.size).toBe(6);
 });
 it("retains the core sky on Low and restores higher detail without reallocating",()=>{
  const sky=createPrSkyArt(PR_ROUNDS[0]),planet=sky.root.getObjectByName("distant-band-planet")!,stars=sky.root.getObjectByName("orbital-starfield") as THREE.Points,traffic=sky.root.children.find(o=>o.name.endsWith("-traffic")) as THREE.InstancedMesh;
  const matrix=traffic.instanceMatrix,geometry=stars.geometry;sky.setQuality("low");expect(planet.visible).toBe(true);expect(stars.geometry.drawRange.count).toBe(70);expect(traffic.count).toBe(5);
  sky.update(1000);sky.setQuality("high");sky.update(5000);expect(traffic.count).toBe(15);expect(stars.geometry.drawRange.count).toBe(300);expect(traffic.instanceMatrix).toBe(matrix);expect(stars.geometry).toBe(geometry);sky.dispose();
 });
 it("disposes shared local resources once, including baked GPU textures",()=>{
  const sky=createPrSkyArt(PR_ROUNDS[1]),resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>();
  sky.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);if(m instanceof THREE.MeshBasicMaterial&&m.map)resources.add(m.map);}}});
  const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));sky.dispose();sky.dispose();sky.update(100);sky.setQuality("low");expect(sky.root.children).toHaveLength(0);for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
 });
});
