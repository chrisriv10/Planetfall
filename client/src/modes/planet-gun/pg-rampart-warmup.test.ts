import {describe,expect,it,vi} from "vitest";
import * as THREE from "three";
import {createPgModeArt} from "./pg-mode-art";

describe("Rampart world shader warm-up",()=>{
 it("waits for compilation and first-use initialization of only the actual opaque pool variants",async()=>{
  const art=createPgModeArt(),world=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  world.fog=new THREE.Fog(0x101c32,100,230);world.add(new THREE.HemisphereLight(),art.group);
  const liveIntegrity=art.group.getObjectByName("panel-integrity") as THREE.Mesh;
  const liveBody=liveIntegrity.parent as THREE.Mesh;
  const originalChildren=[...art.group.children],originalWorld=[...world.children];
  let finish!:()=>void;const compiled=new Promise<void>(resolve=>{finish=resolve;});
  const initialized:THREE.Material[]=[];
  const compileAsync=vi.fn(async(target:THREE.Object3D,view:THREE.Camera,scene:THREE.Scene)=>{
   expect(view).toBe(camera);expect(scene).toBe(world);expect(target.parent).toBeNull();
   const meshes:THREE.Mesh[]=[];target.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
   expect(meshes).toHaveLength(2);expect(meshes.map(m=>m.material)).toEqual([liveBody.material,liveIntegrity.material]);
   expect(meshes.every(m=>m.geometry===liveBody.geometry&&!(m instanceof THREE.InstancedMesh))).toBe(true);
   expect(meshes.map(m=>(m.material as THREE.Material).transparent)).toEqual([false,false]);
   expect(meshes.map(m=>[m.castShadow,m.receiveShadow])).toEqual([[liveBody.castShadow,liveBody.receiveShadow],[liveIntegrity.castShadow,liveIntegrity.receiveShadow]]);
   await compiled;return target;
  });
  const renderer={compileAsync,getContext:()=>({isContextLost:()=>false}),properties:{get:(material:THREE.Material)=>({currentProgram:{getUniforms:()=>{initialized.push(material);}}})}} as unknown as THREE.WebGLRenderer;
  let complete=false;const warm=art.warmRampart(renderer,camera,world).then(()=>{complete=true;});
  await Promise.resolve();expect(complete).toBe(false);expect(initialized).toHaveLength(0);
  expect(art.group.children).toEqual(originalChildren);expect(world.children).toEqual(originalWorld);expect(liveBody.visible).toBe(false);
  finish();await warm;expect(initialized).toEqual([liveBody.material,liveIntegrity.material]);expect(complete).toBe(true);
  expect(compileAsync).toHaveBeenCalledTimes(1);expect(world.children).toEqual(originalWorld);
  const geometryDispose=vi.fn(),materialDispose=vi.fn();liveBody.geometry.addEventListener("dispose",geometryDispose);(liveBody.material as THREE.Material).addEventListener("dispose",materialDispose);
  art.dispose();expect(geometryDispose).toHaveBeenCalledTimes(1);expect(materialDispose).toHaveBeenCalledTimes(1);
 });
 it("propagates compilation failure and does not claim readiness",async()=>{
  const art=createPgModeArt(),get=vi.fn(),renderer={compileAsync:()=>Promise.reject(new Error("driver failure")),getContext:()=>({isContextLost:()=>false}),properties:{get}} as unknown as THREE.WebGLRenderer;
  await expect(art.warmRampart(renderer,new THREE.Camera(),new THREE.Scene())).rejects.toThrow("driver failure");expect(get).not.toHaveBeenCalled();art.dispose();
 });
 it("does not initialize resources disposed or lost while compilation was outstanding",async()=>{
  for(const interruption of ["dispose","context"]){
   const art=createPgModeArt();let lost=false,finish!:()=>void;
   const get=vi.fn(),renderer={compileAsync:()=>new Promise<void>(resolve=>{finish=resolve;}),getContext:()=>({isContextLost:()=>lost}),properties:{get}} as unknown as THREE.WebGLRenderer;
   const warm=art.warmRampart(renderer,new THREE.Camera(),new THREE.Scene());
   if(interruption==="dispose")art.dispose();else lost=true;
   finish();await expect(warm).rejects.toThrow("interrupted");expect(get).not.toHaveBeenCalled();art.dispose();
  }
 });
});
