import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS} from "@planetfall/shared";
import {createPrCountdownArt} from "./pr-countdown-art";

describe("authoritative world countdown cues",()=>{
 it("uses supplied seconds, illuminates three lamps in order, then shows GO for one second",()=>{
  const art=createPrCountdownArt(PR_ROUNDS[0]),lamps=art.root.getObjectByName("countdown-three-lamps") as THREE.InstancedMesh,c=new THREE.Color();
  art.update("intro",3,0);expect(art.root.visible).toBe(false);
  const states:number[][]=[];
  for(const seconds of [3,2,1]){art.update("countdown",seconds,(3-seconds)*1000);expect(art.root.visible).toBe(true);expect(art.root.userData.display).toBe(String(seconds));const row:number[]=[];for(let i=0;i<3;i++){lamps.getColorAt(i,c);row.push(c.getHex());}states.push(row);}
  expect(states[0][0]).not.toBe(states[0][1]);expect(states[1][0]).toBe(states[1][1]);expect(states[1][1]).not.toBe(states[1][2]);expect(states[2][0]).toBe(states[2][2]);
  art.update("running",0,0);expect(art.root.userData.display).toBe("GO");expect(art.root.visible).toBe(true);
  art.update("running",0,999);expect(art.root.visible).toBe(true);art.update("running",0,1000);expect(art.root.visible).toBe(false);art.dispose();
 });
 it("hides outside countdown and the observed start transition, without replaying GO on late attach",()=>{
  const art=createPrCountdownArt(PR_ROUNDS[0]);art.update("running",0,0);expect(art.root.visible).toBe(false);
  art.update("countdown",2,500);art.update("running",0,600);expect(art.root.visible).toBe(true);
  for(const phase of ["round-results","results","lobby","intro"] as const){art.update(phase,0,700);expect(art.root.visible).toBe(false);}
  art.update("running",0,800);expect(art.root.visible).toBe(false);art.dispose();
 });
 it("keeps Low cues and bounded overhead/outboard geometry; redraws only when the display changes",()=>{
  for(const round of PR_ROUNDS){const art=createPrCountdownArt(round),lamps=art.root.getObjectByName("countdown-three-lamps") as THREE.InstancedMesh;
   expect(art.root.children.length).toBeLessThanOrEqual(3);expect(lamps.count).toBe(3);art.setQuality("low");art.update("countdown",3,0);expect(art.root.visible).toBe(true);
   const version=lamps.instanceColor!.version;art.update("countdown",3,400);expect(lamps.instanceColor!.version).toBe(version);
   if(round.category==="race"){
    expect(art.root.position.toArray()).toEqual([0,5,-6]);
    for(const spawn of round.spawns)expect(art.root.position.z).toBeLessThan(spawn.z);
   }else if(round.category==="final")expect(art.root.position.toArray()).toEqual([0,29,-33]);else expect(art.root.position.toArray()).toEqual([0,8,-24]);
   art.dispose();
  }
 });
 it("disposes geometry, material, and instance resources exactly once",()=>{
  const art=createPrCountdownArt(PR_ROUNDS[0]),callbacks:(ReturnType<typeof vi.fn>)[]=[];
  for(const node of art.root.children as THREE.Mesh[]){for(const resource of [node.geometry,node.material as THREE.Material]){const fn=vi.fn();callbacks.push(fn);resource.addEventListener("dispose",fn);}if(node instanceof THREE.InstancedMesh){const fn=vi.fn();callbacks.push(fn);node.addEventListener("dispose",fn);}}
  art.dispose();art.dispose();for(const fn of callbacks)expect(fn).toHaveBeenCalledTimes(1);expect(art.root.children).toHaveLength(0);
 });
});
