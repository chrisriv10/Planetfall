import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {prRound} from "@planetfall/shared";
import {PrWorldRenderer} from "./pr-world";
import {prCameraSurfaceBlocks} from "./pr-camera-collision";

describe("PlanetRun camera hazard obstruction",()=>{
 it("passes through an open shutter but blocks its closed collision proxy under the art",()=>{
  const view=new PrWorldRenderer(prRound("capacitor-causeway"));
  try{
   const body=view.root.getObjectByName("pulse-shutter-1")!,proxy=body.getObjectByName("authoritative-hazard")!;
   const ray=new THREE.Raycaster(new THREE.Vector3(0,1.57,-23),new THREE.Vector3(0,0,1),0,5);
   for(const [ms,blocks]of [[2640,false],[0,true]]as const){
    view.update(ms,0,new Map());view.root.updateMatrixWorld(true);
    expect(proxy.visible).toBe(false);expect(ray.intersectObject(proxy,false).length).toBeGreaterThan(0);
    expect(prCameraSurfaceBlocks(proxy)).toBe(blocks);
   }
  }finally{view.dispose();}
 });
 it("ignores warning-only arcs and retains active discharge obstruction",()=>{
  const view=new PrWorldRenderer(prRound("capacitor-causeway"));
  try{
   const proxy=view.root.getObjectByName("capacitor-arc-0")!.getObjectByName("authoritative-hazard")!;
   for(const [ms,blocks]of [[0,false],[1000,true],[3000,false]]as const){view.update(ms,0,new Map());expect(prCameraSurfaceBlocks(proxy)).toBe(blocks);}
   expect(prCameraSurfaceBlocks(view.root.getObjectByName("authoritative-platform")!)).toBe(true);
  }finally{view.dispose();}
 });
});
