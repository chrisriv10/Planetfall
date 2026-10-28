import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {PR_ROUNDS,prObstacleTransform} from "@planetfall/shared";
import {createPrCapacitorArt} from "./pr-art-capacitor";
import {createPrShatterdeckArt} from "./pr-art-shatterdeck";
import type {PrArtContext} from "./pr-art-shared";

function context(id:"capacitor-causeway"|"shatterdeck"):PrArtContext {
 const round=PR_ROUNDS.find(r=>r.id===id)!,root=new THREE.Group(),platforms=new Map<string,THREE.Group>(),obstacles=new Map<string,THREE.Group>();
 for(const p of round.platforms){const g=new THREE.Group();g.position.copy(p.center);root.add(g);platforms.set(p.id,g);}
 for(const o of round.obstacles){const g=new THREE.Group();g.position.copy(o.center);root.add(g);obstacles.set(o.id,g);}
 return {round,root,platforms,obstacles,surfaces:new Map(),hazardVolumes:new Map()};
}
describe("capacitor / final presentation boundaries",()=>{
 it("keeps lane shells in hit boxes, with one open lane and advance next-lane markers",()=>{
  const ctx=context("capacitor-causeway"),art=createPrCapacitorArt(ctx);
  const shutters=ctx.round.obstacles.filter(o=>o.kind==="shutter");expect(shutters).toHaveLength(6);
  for(const o of shutters)for(const state of ["open","next"]){
   const marker=ctx.root.getObjectByName(`capacitor-${state}-${o.id}`)!;marker.updateWorldMatrix(true,true);
   marker.traverse(node=>{if(!(node instanceof THREE.InstancedMesh))return;for(const f of node.userData.features){if(f.name==="lane-status")expect(f.placement[1]-f.placement[4]/2).toBeGreaterThan(6);}});
  }
  for(const o of ctx.round.obstacles.filter(o=>o.kind==="shutter"||o.kind==="barrier"||o.kind==="arc")){const g=ctx.obstacles.get(o.id)!;g.position.set(0,0,0);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);
   for(const axis of ["x","y","z"] as const){expect(b.min[axis]).toBeGreaterThanOrEqual(-o.half[axis]-.01);expect(b.max[axis]).toBeLessThanOrEqual(o.half[axis]+.01);}g.position.copy(o.center);
  }
  for(const seed of [0,173,996])for(let ms=0;ms<15000;ms+=50){art.update(ms,seed,new Map());
   for(const z of [-20,-106]){const row=shutters.filter(o=>o.center.z===z);let openCount=0;
    for(const o of row){const state=prObstacleTransform(o,ms,seed),open=ctx.root.getObjectByName(`capacitor-open-${o.id}`)!;
     expect(open.visible).toBe(!state.active);if(open.visible)openCount++;
     expect(ctx.root.getObjectByName(`capacitor-shell-${o.id}`)!.visible).toBe(state.active);
     const next=ctx.root.getObjectByName(`capacitor-next-${o.id}`)!;
     if(next.visible){expect(state.warning).toBe(true);expect(state.active).toBe(true);expect(prObstacleTransform(o,ms+o.period*1000/3*.22,seed).active).toBe(false);}
    }expect(openCount).toBe(1);
   }
  }art.dispose();
 });
 it("shows flat charge warnings before a bounded discharge and clears them on cooldown",()=>{
  const ctx=context("capacitor-causeway"),art=createPrCapacitorArt(ctx),arcs=ctx.round.obstacles.filter(o=>o.kind==="arc");expect(arcs).toHaveLength(3);
  for(const o of arcs){let warningSeen=false,activeSeen=false,coolSeen=false;
   for(let ms=0;ms<10000;ms+=40){art.update(ms,173,new Map());const state=prObstacleTransform(o,ms,173);
    expect(ctx.root.getObjectByName(`capacitor-discharge-${o.id}`)!.visible).toBe(state.active);
    const warning=ctx.root.getObjectByName(`capacitor-warning-${o.id}`)!;expect(warning.visible).toBe(state.warning);
    if(state.warning){warningSeen=true;ctx.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(warning);expect(b.max.y-b.min.y).toBeLessThan(.01);expect(b.max.z-b.min.z).toBeLessThanOrEqual(o.half.z*2+.001);}
    activeSeen ||=state.active;coolSeen ||= !state.active&&!state.warning;
   }expect(warningSeen&&activeSeen&&coolSeen).toBe(true);
  }art.dispose();
 });
 it("preserves hazard visibility across quality changes and restores replaced volumes",()=>{
  const ctx=context("capacitor-causeway"),volumes=new Map<string,THREE.Mesh>();
  for(const o of ctx.round.obstacles){const mesh=new THREE.Mesh();volumes.set(o.id,mesh);}
  const art=createPrCapacitorArt({...ctx,hazardVolumes:volumes});art.update(0,0,new Map());
  for(const q of ["low","medium","high"] as const){art.setQuality(q);
   for(const o of ctx.round.obstacles){if(o.kind!=="shutter"&&o.kind!=="arc"&&o.kind!=="barrier")continue;expect(volumes.get(o.id)!.visible).toBe(false);
    if(o.kind==="shutter")expect(ctx.root.getObjectByName(`capacitor-shell-${o.id}`)!.visible).toBe(prObstacleTransform(o,0,0).active);
   }
  }art.dispose();for(const mesh of volumes.values())expect(mesh.visible).toBe(true);
 });
 it("keeps final scenery clear of all playable tile footprints and central scenery below kill",()=>{
  const ctx=context("shatterdeck"),art=createPrShatterdeckArt(ctx);
  const footprint=Math.max(...ctx.round.tiles.map(t=>Math.hypot(t.center.x,t.center.z)))+1.35;
  for(const ms of [0,12345,60000]){art.update(ms,0,new Map());ctx.root.updateMatrixWorld(true);ctx.root.traverse(node=>{
   if(!(node instanceof THREE.InstancedMesh))return;
   const matrix=new THREE.Matrix4(),b=new THREE.Box3();node.geometry.computeBoundingBox();
   for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);matrix.premultiply(node.matrixWorld);b.copy(node.geometry.boundingBox!).applyMatrix4(matrix);
    if(b.max.y<ctx.round.killY)continue;
    // Hoops have open centres; test their inside radius separately.
    if(node.geometry.type==="TorusGeometry"&&node.userData.features[i].placement[0]===0&&node.userData.features[i].placement[2]===0){const feature=node.userData.features[i];expect(feature.placement[3]*.965).toBeGreaterThan(footprint);continue;}
    const dx=Math.max(b.min.x,0,-b.max.x),dz=Math.max(b.min.z,0,-b.max.z);
    expect(Math.hypot(dx,dz)).toBeGreaterThan(footprint);
   }
  });}art.dispose();
 });
 it("bounds batches, retains landmarks on low, and cleans up idempotently",()=>{
  for(const id of ["capacitor-causeway","shatterdeck"] as const){const ctx=context(id),initial=ctx.root.children.length,art=id==="shatterdeck"?createPrShatterdeckArt(ctx):createPrCapacitorArt(ctx);let meshes=0;
   ctx.root.traverse(n=>{if(n instanceof THREE.Mesh)meshes++;});expect(meshes).toBeLessThanOrEqual(70);
   if(id==="shatterdeck")expect(meshes).toBe(27);
   art.setQuality("low");art.update(9000,7,new Map());expect(ctx.root.getObjectByName(id==="shatterdeck"?"shatterdeck-final-containment":"capacitor-bank-pulse-0")!.visible).toBe(true);
   art.dispose();art.dispose();expect(ctx.root.children.length).toBe(initial);
  }
 });
 it("keeps containment tubing slender and circuit panels flush inside true support",()=>{
  const final=context("shatterdeck"),fa=createPrShatterdeckArt(final);
  final.root.traverse(node=>{if(!(node instanceof THREE.InstancedMesh)||node.geometry.type!=="TorusGeometry")return;
   const geometry=node.geometry;geometry.computeBoundingBox();expect(geometry.boundingBox!.max.z-geometry.boundingBox!.min.z).toBeLessThan(.008);
   expect(geometry.getIndex()!.count).toBeLessThan(40*5*6);
  });fa.dispose();
  const ctx=context("capacitor-causeway"),art=createPrCapacitorArt(ctx);
  for(const p of ctx.round.platforms)ctx.platforms.get(p.id)!.traverse(node=>{if(!(node instanceof THREE.InstancedMesh))return;for(const f of node.userData.features){if(!f.name.startsWith("panel-")&&f.name!=="inset-circuit-panel")continue;const [x,y,z,sx,sy,sz]=f.placement;expect(Math.abs(x)+sx/2).toBeLessThan(p.half.x);expect(Math.abs(z)+sz/2).toBeLessThan(p.half.z);expect(y+sy/2-p.half.y).toBeLessThan(.02);}});
  art.dispose();
 });
});
