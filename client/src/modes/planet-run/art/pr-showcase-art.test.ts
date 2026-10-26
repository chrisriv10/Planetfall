import {afterEach,describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPrShowcaseArt,PR_SHOWCASE_MOTIFS} from "./pr-showcase-art";

afterEach(()=>vi.unstubAllGlobals());
function sceneState(root:THREE.Object3D){
 root.updateMatrixWorld(true);const nodes:unknown[]=[];
 root.traverse(o=>nodes.push({visible:o.visible,matrix:[...o.matrixWorld.elements],
  instances:o instanceof THREE.InstancedMesh?Array.from(o.instanceMatrix.array):null,
  materials:o instanceof THREE.Mesh?(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.toJSON()):null}));
 return nodes;
}

describe("six-round home showcase",()=>{
 it("freezes actual meshes, instance transforms and materials under reduced motion, including a live preference change",()=>{
  const preference={matches:true};vi.stubGlobal("matchMedia",vi.fn(()=>preference));
  const view=createPrShowcaseArt();
  try{
   const initial=sceneState(view.root);
   for(const time of [1,7.2,16.5,28.6,60,NaN,Infinity]){view.update(time);expect(sceneState(view.root)).toEqual(initial);}
   preference.matches=false;for(let frame=0;frame<120;frame++)view.update(15+frame/60);
   preference.matches=true;view.update(17);const frozen=sceneState(view.root);
   for(const time of [18,28.6,61]){view.update(time);expect(sceneState(view.root)).toEqual(frozen);}
   expect(view.currentMotif).toBe("cargo");
   expect(frozen).toEqual(initial);
  }finally{view.dispose();}
 });
 it("places actual soles over each endpoint platform and the surviving Shatterdeck cell",()=>{
  vi.stubGlobal("matchMedia",()=>({matches:false}));
  for(let motif=0;motif<6;motif++)for(const phase of [.3,4.5]){
   const view=createPrShowcaseArt();
   try{
    // Advance normally so the endpoint includes the settled gait and landing pose.
    for(let frame=0;frame<=Math.round(phase*60);frame++)view.update(motif*5+frame/60);
    view.root.updateMatrixWorld(true);
    const astronaut=view.root.getObjectByName("showcase-astronaut")!,soles:THREE.Mesh[]=[];
    astronaut.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry instanceof THREE.BoxGeometry&&o.geometry.parameters.width===.36)soles.push(o);});
    expect(soles).toHaveLength(2);
    const platform=view.root.getObjectByName(`showcase-${PR_SHOWCASE_MOTIFS[motif]}`)!;
    for(const sole of soles){
     const samples=[];
     for(const x of [-.16,0,.16])for(const z of [-.21,0,.21]){
      const bottom=new THREE.Vector3(x,-.04,z).applyMatrix4(sole.matrixWorld);
      const ray=new THREE.Raycaster(bottom.clone().add(new THREE.Vector3(0,.12,0)),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(platform,true)[0];if(hit)samples.push({gap:bottom.y-hit.point.y,point:hit.point});
     }
     const contact=samples.sort((a,b)=>a.gap-b.gap)[0];
     expect(contact,`${PR_SHOWCASE_MOTIFS[motif]} at ${phase}: supported sole`).toBeDefined();
     const gap=contact.gap;
     // Roller crests are rounded; flat decks should contact within 2 cm.
     expect(gap,`${PR_SHOWCASE_MOTIFS[motif]} at ${phase}: sole gap`).toBeGreaterThan(-.02);
     expect(gap,`${PR_SHOWCASE_MOTIFS[motif]} at ${phase}: sole gap`).toBeLessThan(motif===0?.12:.02);
     if(motif===5)expect(contact.point.y).toBeCloseTo(.1,3);
    }
   }finally{view.dispose();}
  }
 });
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
