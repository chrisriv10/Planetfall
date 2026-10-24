import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {prRound,type PrRoundId} from "@planetfall/shared";
import type {PrArtContext} from "./pr-art-shared";
import {createPrMeteorArtCourse} from "./pr-art-meteor";
import {createPrFluxArt} from "./pr-art-flux";

function context(id:PrRoundId):PrArtContext{
 const round=prRound(id),root=new THREE.Group(),platforms=new Map<string,THREE.Group>(),surfaces=new Map<string,THREE.Mesh>();
 for(const p of round.platforms){const group=new THREE.Group();group.position.copy(p.center);root.add(group);platforms.set(p.id,group);const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());mesh.scale.set(p.half.x*2,p.half.y*2,p.half.z*2);group.add(mesh);surfaces.set(p.id,mesh);}
 const obstacles=new Map<string,THREE.Group>();for(const o of round.obstacles){const group=new THREE.Group();group.position.copy(o.center);root.add(group);obstacles.set(o.id,group);}
 return {round,root,platforms,surfaces,obstacles,hazardVolumes:new Map()};
}
describe("garden course presentation",()=>{
 for(const [id,build] of [["meteor-garden",createPrMeteorArtCourse],["flux-gardens",createPrFluxArt]] as const)it(`${id} preserves support and owns bounded disposable art`,()=>{
  const ctx=context(id),saved=[...ctx.surfaces.values()].map(m=>({m,geometry:m.geometry,material:m.material,scale:m.scale.clone()})),baseline=ctx.root.children.length;
  const art=build(ctx);let batches=0;ctx.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)batches++;});expect(batches).toBeLessThanOrEqual(70);
  for(const q of ["low","medium","high"] as const){art.setQuality(q);art.update(7821,42,new Map());for(const s of saved){expect(s.m.geometry).toBe(s.geometry);expect(s.m.scale.equals(s.scale)).toBe(true);}}
  art.dispose();art.dispose();expect(ctx.root.children.length).toBe(baseline);for(const s of saved){expect(s.m.material).toBe(s.material);expect(s.m.parent?.children.length).toBe(1);s.geometry.dispose();(s.material as THREE.Material).dispose();}
 });
 it("keeps flat planting outside meteor footprints",()=>{
  const ctx=context("meteor-garden"),art=createPrMeteorArtCourse(ctx);
  for(const p of ctx.round.platforms)ctx.platforms.get(p.id)!.traverse(o=>{for(const f of o.userData.features??[]){if(f.name!=="safe-lane-leaf-inlay")continue;const x=p.center.x+f.placement[0],z=p.center.z+f.placement[2];for(const h of ctx.round.obstacles)expect(Math.abs(x-h.center.x)>=h.half.x+.7||Math.abs(z-h.center.z)>=h.half.z+.7).toBe(true);}});
  art.dispose();
 });
 it("only marks authoritative low gravity platforms with ascending petals",()=>{
  const ctx=context("flux-gardens"),art=createPrFluxArt(ctx);
  for(const p of ctx.round.platforms)expect(!!ctx.platforms.get(p.id)!.getObjectByName(`low-gravity-petals:${p.id}`)).toBe((p.gravityScale??1)<1);
  expect(ctx.root.getObjectByName("flux-bloom-landmark")).toBeDefined();art.dispose();
 });
});
