import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {createPgMuzzleArt,PG_MUZZLE_SIGNATURES} from "./pg-muzzle-art";
import type {PgWeaponId} from "@planetfall/shared";

describe("PlanetGun pooled muzzle art",()=>{
 it("has ten distinct bounded signatures and reuses nodes under repeated firing",()=>{
  expect(new Set(Object.values(PG_MUZZLE_SIGNATURES).map(p=>p.join(","))).size).toBe(10);
  const art=createPgMuzzleArt(),nodes:THREE.Object3D[]=[];art.root.traverse(o=>nodes.push(o));
  for(let i=0;i<500;i++){art.fire((Object.keys(PG_MUZZLE_SIGNATURES)as PgWeaponId[])[i%10],i*4);art.update(i*4+2);}
  const after:THREE.Object3D[]=[];art.root.traverse(o=>after.push(o));expect(after).toEqual(nodes);expect(art.root.children).toHaveLength(4);
  art.update(10000);expect(art.root.children.every(o=>!o.visible)).toBe(true);art.dispose();
 });
 it("keeps its origin fixed and disposes shared geometry once",()=>{
  const art=createPgMuzzleArt(),mesh=art.root.children[0].children[0]as THREE.Mesh,dispose=vi.spyOn(mesh.geometry,"dispose");art.root.position.set(.2,-.2,-.8);art.fire("rail",10);art.update(20);expect(art.root.position.toArray()).toEqual([.2,-.2,-.8]);art.dispose();art.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
});
