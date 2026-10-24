import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {prRound} from '@planetfall/shared';
import {createPrSolarArt} from './pr-art-solar';
import type {PrArtContext} from './pr-art-shared';

function fixture():PrArtContext {
 const round=prRound('solar-sweep'),root=new THREE.Group(),platforms=new Map<string,THREE.Group>(),obstacles=new Map<string,THREE.Group>(),surfaces=new Map<string,THREE.Mesh>(),hazardVolumes=new Map<string,THREE.Mesh>();
 for(const p of round.platforms){const g=new THREE.Group();g.position.copy(p.center);root.add(g);platforms.set(p.id,g);const m=new THREE.Mesh(new THREE.BoxGeometry(p.half.x*2,p.half.y*2,p.half.z*2));g.add(m);surfaces.set(p.id,m);}
 for(const o of round.obstacles){const g=new THREE.Group();g.position.copy(o.center);root.add(g);obstacles.set(o.id,g);const m=new THREE.Mesh(new THREE.BoxGeometry(o.half.x*2,o.half.y*2,o.half.z*2));g.add(m);hazardVolumes.set(o.id,m);}
 return {round,root,platforms,obstacles,surfaces,hazardVolumes};
}
describe('Solar collector art',()=>{
 it('bounds every arm instance to its exact local authority envelope',()=>{
  const ctx=fixture(),art=createPrSolarArt(ctx),matrix=new THREE.Matrix4();
  for(const o of ctx.round.obstacles)for(const child of ctx.obstacles.get(o.id)!.children){if(!(child instanceof THREE.InstancedMesh))continue;
   child.geometry.computeBoundingBox();for(let i=0;i<child.count;i++){child.getMatrixAt(i,matrix);const b=child.geometry.boundingBox!.clone().applyMatrix4(matrix);
    for(const axis of ['x','y','z'] as const){expect(b.min[axis]).toBeGreaterThanOrEqual(-o.half[axis]-.01);expect(b.max[axis]).toBeLessThanOrEqual(o.half[axis]+.01);}
   }
  }art.dispose();
 });
 it('clips all floor decoration to supports and never bridges gaps',()=>{
  const ctx=fixture(),art=createPrSolarArt(ctx),matrix=new THREE.Matrix4();
  ctx.root.traverse(child=>{if(!(child instanceof THREE.InstancedMesh))return;const features=child.userData.features as {name:string}[];
   child.geometry.computeBoundingBox();features.forEach((feature,i)=>{if(!['collector-cell','cell-contact','cell-terminal','radial-bus'].includes(feature.name))return;
    child.getMatrixAt(i,matrix);const b=child.geometry.boundingBox!.clone().applyMatrix4(matrix);
    expect(ctx.round.platforms.some(p=>b.min.x>=p.center.x-p.half.x&&b.max.x<=p.center.x+p.half.x&&b.min.z>=p.center.z-p.half.z&&b.max.z<=p.center.z+p.half.z)).toBe(true);
    expect(b.max.y).toBeLessThan(.625);
   });
  });art.dispose();
 });
 it('retains the turbine on Low, bounds draw batches, restores materials on disposal',()=>{
  const ctx=fixture(),materials=[...ctx.surfaces.values()].map(m=>m.material),art=createPrSolarArt(ctx);let batches=0;ctx.root.traverse(n=>{if(n instanceof THREE.InstancedMesh)batches++;});expect(batches).toBeLessThanOrEqual(66);
  art.setQuality('low');expect(ctx.root.getObjectByName('solar-overhead-turbine')!.visible).toBe(true);expect(ctx.root.getObjectByName('solar-tracking-sail')!.visible).toBe(false);
  const before=ctx.obstacles.get('solar-low')!.rotation.y;art.update(10000,55,new Map());expect(ctx.obstacles.get('solar-low')!.rotation.y).toBe(before);
  art.dispose();art.dispose();expect([...ctx.surfaces.values()].map(m=>m.material)).toEqual(materials);
 });
});
