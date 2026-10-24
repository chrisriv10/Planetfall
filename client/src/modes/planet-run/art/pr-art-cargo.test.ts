import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {prRound,prPlatformCenter} from '@planetfall/shared';
import {createPrCargoArt} from './pr-art-cargo';
import type {PrArtContext} from './pr-art-shared';

function fixture():PrArtContext {
 const round=prRound('cargo-cyclone'),root=new THREE.Group(),platforms=new Map<string,THREE.Group>(),obstacles=new Map<string,THREE.Group>(),surfaces=new Map<string,THREE.Mesh>(),hazardVolumes=new Map<string,THREE.Mesh>();
 for(const p of round.platforms){const g=new THREE.Group();g.position.copy(p.center);root.add(g);platforms.set(p.id,g);const m=new THREE.Mesh(new THREE.BoxGeometry(p.half.x*2,p.half.y*2,p.half.z*2));g.add(m);surfaces.set(p.id,m);}
 for(const o of round.obstacles){const g=new THREE.Group();g.position.copy(o.center);root.add(g);obstacles.set(o.id,g);const m=new THREE.Mesh(new THREE.BoxGeometry(o.half.x*2,o.half.y*2,o.half.z*2));g.add(m);hazardVolumes.set(o.id,m);}
 return {round,root,platforms,obstacles,surfaces,hazardVolumes};
}
describe('Cargo freight art',()=>{
 it('keeps support geometry/transforms and follows moving deck parents',()=>{
  const ctx=fixture(),before=[...ctx.surfaces.values()].map(m=>({m,geometry:m.geometry,scale:m.scale.clone(),material:m.material})),art=createPrCargoArt(ctx);
  const p=ctx.round.platforms.find(p=>p.motion)!,group=ctx.platforms.get(p.id)!;
  expect(group.children.some(c=>c instanceof THREE.InstancedMesh)).toBe(true);
  group.position.copy(prPlatformCenter(p,4200));const position=group.position.clone();art.update(4200,1,new Map());expect(group.position.equals(position)).toBe(true);
  for(const b of before){expect(b.m.geometry).toBe(b.geometry);expect(b.m.scale.equals(b.scale)).toBe(true);}
  art.dispose();art.dispose();for(const b of before)expect(b.m.material).toBe(b.material);
  let batches=0;ctx.root.traverse(n=>{if(n instanceof THREE.InstancedMesh)batches++;});expect(batches).toBe(0);
 });
 it('has bounded batches, deterministic ambient motion and a landmark on Low',()=>{
  const ctx=fixture(),art=createPrCargoArt(ctx);let batches=0;ctx.root.traverse(n=>{if(n instanceof THREE.InstancedMesh)batches++;});expect(batches).toBeLessThanOrEqual(66);
  const rotor=ctx.root.getObjectByName('cargo-cyclone-sorter')!,traffic=ctx.root.getObjectByName('cargo-parallel-traffic')!;
  art.update(2000,0,new Map());const angle=rotor.rotation.z;art.update(1000,0,new Map());art.update(2000,0,new Map());expect(rotor.rotation.z).toBe(angle);
  art.setQuality('low');expect(rotor.visible).toBe(true);expect(traffic.visible).toBe(false);art.dispose();
 });
 it('uses cross-course conveyor paint without extending any support',()=>{
  const ctx=fixture(),art=createPrCargoArt(ctx),matrix=new THREE.Matrix4();
  ctx.root.traverse(child=>{if(!(child instanceof THREE.InstancedMesh))return;const features=child.userData.features as {name:string;placement:number[]}[];
   child.geometry.computeBoundingBox();features.forEach((f,i)=>{if(!['freight-belt','belt-slats','freight-spine','belt-direction','freight-manifest-code'].includes(f.name))return;
    child.getMatrixAt(i,matrix);const b=child.geometry.boundingBox!.clone().applyMatrix4(matrix);if(child.parent!==ctx.root)b.translate(child.parent!.position);
    expect(ctx.round.platforms.some(p=>b.min.x>=p.center.x-p.half.x&&b.max.x<=p.center.x+p.half.x&&b.min.z>=p.center.z-p.half.z&&b.max.z<=p.center.z+p.half.z)).toBe(true);
    if(f.name==='freight-belt'&&child.parent!==ctx.root)expect(f.placement[3]).toBeGreaterThan(f.placement[5]);
   });
  });art.dispose();
 });
});
