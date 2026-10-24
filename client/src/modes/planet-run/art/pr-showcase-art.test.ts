import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPrShowcaseArt,PR_SHOWCASE_MOTIFS} from "./pr-showcase-art";

describe("six-round home showcase",()=>{
 it("cycles one unmistakable miniature every five seconds within the home card bounds",()=>{
  const view=createPrShowcaseArt(),bounds=new THREE.Box3();
  for(let i=0;i<6;i++)for(const phase of [0,.5,2,3.5,4.9]){
   view.update(i*5+phase);expect(view.currentMotif).toBe(PR_SHOWCASE_MOTIFS[i]);const motifs=view.root.children[0].children.filter(o=>o.name.startsWith("showcase-")&&o.name!=="showcase-astronaut");expect(motifs.filter(o=>o.visible)).toHaveLength(1);
   view.root.updateMatrixWorld(true);bounds.makeEmpty();let draws=0;view.root.traverseVisible(o=>{if(o instanceof THREE.Mesh){draws++;bounds.union(new THREE.Box3().setFromObject(o));}});
   expect(draws).toBeLessThan(65);expect(bounds.min.x).toBeGreaterThan(-6.5);expect(bounds.max.x).toBeLessThan(6.5);expect(bounds.min.z).toBeGreaterThan(-6.5);expect(bounds.max.z).toBeLessThan(6.5);expect(bounds.min.y).toBeGreaterThan(-3);expect(bounds.max.y).toBeLessThan(5);
  }view.update(30);expect(view.currentMotif).toBe("cargo");view.dispose();
 });
 it("retains canonical astronaut motion and a bounded shared collapse pool",()=>{
  const view=createPrShowcaseArt(),astronaut=view.root.getObjectByName("showcase-astronaut")!,tiles=view.root.getObjectByName("miniature-collapsing-hexes") as THREE.InstancedMesh;
  expect(astronaut.getObjectByName("astronaut-eyes")).toBeDefined();expect(tiles.count).toBe(38);const position=astronaut.position.clone(),instanceMatrix=tiles.instanceMatrix;
  view.update(25.5);expect(astronaut.position.equals(position)).toBe(false);view.update(28.5);expect(tiles.instanceMatrix).toBe(instanceMatrix);for(const value of tiles.instanceMatrix.array)expect(Number.isFinite(value)).toBe(true);view.dispose();
 });
 it("disposes every shared geometry, material, and instance buffer exactly once",()=>{
  const view=createPrShowcaseArt(),resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.InstancedMesh>();
  view.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);if(o instanceof THREE.InstancedMesh)resources.add(o);}});
  const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));view.dispose();view.dispose();view.update(17);expect(view.root.children).toHaveLength(0);for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
 });
});
