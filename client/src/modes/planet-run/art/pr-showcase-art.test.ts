import {afterEach,describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPrShowcaseArt} from "./pr-showcase-art";
afterEach(()=>vi.unstubAllGlobals());
function sceneState(root:THREE.Object3D){
 root.updateMatrixWorld(true);const nodes:unknown[]=[];
 root.traverse(o=>nodes.push({visible:o.visible,matrix:[...o.matrixWorld.elements],instances:o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):null,materials:o instanceof THREE.Mesh?(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.toJSON()):null}));return nodes;
}
describe("single solar home diorama",()=>{
 it("freezes every mesh and material, including a live reduced-motion change",()=>{
  const preference={matches:true};vi.stubGlobal("matchMedia",()=>preference);const view=createPrShowcaseArt();
  try{
   const initial=sceneState(view.root);
   for(const time of [1,7.2,16.5,28.6,60,NaN,Infinity]){view.update(time);expect(sceneState(view.root)).toEqual(initial);}
   preference.matches=false;for(let frame=0;frame<120;frame++)view.update(3+frame/60);
   preference.matches=true;view.update(17);
   for(const time of [18,28.6,61]){view.update(time);expect(sceneState(view.root)).toEqual(initial);}
  }finally{view.dispose();}
 });
 it("plants both soles on the deck before and after the jump",()=>{
  const view=createPrShowcaseArt();
  try{for(const phase of[2,6,10,14]){
   for(let frame=0;frame<=phase*60;frame++)view.update(frame/60);
   view.root.updateMatrixWorld(true);const soles:THREE.Mesh[]=[];
   view.root.getObjectByName("showcase-astronaut")!.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry instanceof THREE.BoxGeometry&&o.geometry.parameters.width===.36)soles.push(o);});expect(soles).toHaveLength(2);
   for(const sole of soles){
    const bottom=new THREE.Vector3(0,-.04,0).applyMatrix4(sole.matrixWorld);
    const hit=new THREE.Raycaster(bottom.clone().add(new THREE.Vector3(0,.12,0)),new THREE.Vector3(0,-1,0)).intersectObject(view.root.getObjectByName("showcase-solar")!,true)[0];
    expect(hit).toBeDefined();expect(bottom.y-hit.point.y).toBeGreaterThan(-.02);expect(bottom.y-hit.point.y).toBeLessThan(.02);
   }
  }}finally{view.dispose();}
 });
 it("retains one framed hero, bounded draws and immutable instance buffers",()=>{
  const view=createPrShowcaseArt(),buffers:THREE.InstancedBufferAttribute[]=[];
  view.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)buffers.push(o.instanceMatrix);});
  for(let t=0;t<24;t+=.25){
   view.update(t);expect(view.currentMotif).toBe("solar");const bounds=new THREE.Box3();let draws=0;
   view.root.updateMatrixWorld(true);view.root.traverseVisible(o=>{expect(o instanceof THREE.Light).toBe(false);if(o instanceof THREE.Mesh){draws++;bounds.union(new THREE.Box3().setFromObject(o));}});
   expect(draws).toBeLessThan(65);expect(bounds.min.x).toBeGreaterThan(-6.5);expect(bounds.max.x).toBeLessThan(6.5);expect(bounds.min.z).toBeGreaterThan(-6.5);expect(bounds.max.z).toBeLessThan(6.5);expect(bounds.min.y).toBeGreaterThan(-3);expect(bounds.max.y).toBeLessThan(5);
  }
  const after:THREE.InstancedBufferAttribute[]=[];view.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)after.push(o.instanceMatrix);});expect(after).toEqual(buffers);view.dispose();
 });
 it("disposes shared resources exactly once",()=>{
  const view=createPrShowcaseArt(),resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.InstancedMesh>();
  view.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);if(o instanceof THREE.InstancedMesh)resources.add(o);}});
  const spies=[...resources].map(r=>vi.spyOn(r,"dispose"));view.dispose();view.dispose();view.update(17);expect(view.root.children).toHaveLength(0);for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);
 });
});
