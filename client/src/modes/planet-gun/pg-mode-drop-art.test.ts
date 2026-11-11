import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import type {PgModeDrop,PgWeaponId} from "@planetfall/shared";
import {createPgModeDropArt,PG_DROP_ART_CAPACITY} from "./pg-mode-drop-art";
const drop=(weapon:PgWeaponId,id:string=weapon):PgModeDrop=>({id,kind:"weapon",weapon,position:{x:3,y:2.25,z:-4},magazine:10,reserve:20});
describe("PlanetGun weapon pickup presentation",()=>{
 it("renders every canonical weapon at its settled floor anchor with distinct recognizable geometry",()=>{
  const art=createPgModeDropArt(),ids:PgWeaponId[]=["pulse","nova","photon","quasar","rail","comet","helix","arc","prism","orbit"],signatures=new Set<string>(),matrix=new THREE.Matrix4();art.update(ids.map(id=>drop(id)));
  for(const id of ids){const mesh=art.group.getObjectByName(`pg-dropped-weapon-${id}`) as THREE.InstancedMesh;expect(mesh.count).toBe(1);expect(mesh.userData.weaponId).toBe(id);expect(mesh.userData.dropIds[0]).toBe(id);mesh.getMatrixAt(0,matrix);expect(matrix.elements.slice(12,15)).toEqual([3,2.25,-4]);expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(100);expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(.035,4);signatures.add(JSON.stringify(Array.from(mesh.geometry.getAttribute("position").array)));}expect(signatures.size).toBe(10);art.dispose();
 });
 it("caps the complete pool, reuses resources and clears missing or exited drops",()=>{
  const art=createPgModeDropArt();art.update([drop("pulse")]);const mesh=art.group.getObjectByName("pg-dropped-weapon-pulse") as THREE.InstancedMesh,geometry=mesh.geometry,material=mesh.material,dispose=vi.spyOn(geometry,"dispose");art.update(Array.from({length:60},(_,i)=>drop("pulse",String(i))));expect(mesh.count).toBe(PG_DROP_ART_CAPACITY);const markers=art.group.getObjectByName("pg-weapon-drop-markers") as THREE.InstancedMesh;expect(markers.count).toBe(48);art.update([drop("pulse")]);expect(mesh.count).toBe(1);expect(mesh.geometry).toBe(geometry);expect(mesh.material).toBe(material);art.update(null);expect(mesh.count).toBe(0);expect(markers.count).toBe(0);expect(art.group.visible).toBe(false);art.dispose();art.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
});

it("lazily batches by recognized finish and preserves independent swatches and floor support",()=>{
 const art=createPgModeDropArt();
 expect(art.group.children.map(o=>o.name)).toEqual(["pg-weapon-drop-markers"]);
 const pulse=(id:string,finishId?:string)=>({...drop("pulse",id),finishId});
 const solar="finish-solar-alloy",nebula="finish-nebula-drift";
 const find=(key:string)=>art.group.getObjectByName("pg-dropped-weapon-pulse"+key) as THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 art.update([pulse("one",solar),pulse("two",solar),pulse("default"),pulse("unknown","not-a-finish")]);
 const painted=find("-"+solar),plain=find("");
 expect(painted.count).toBe(2);expect(plain.count).toBe(2);expect(art.group.children).toHaveLength(3);
 expect(painted.userData.dropIds.slice(0,2)).toEqual(["one","two"]);
 expect(painted.geometry.boundingBox!.min.y).toBeCloseTo(plain.geometry.boundingBox!.min.y);
 expect(painted.geometry.getAttribute("position").array).toEqual(plain.geometry.getAttribute("position").array);
 expect(painted.geometry.getAttribute("color").array).not.toEqual(plain.geometry.getAttribute("color").array);
 expect(painted.material.map).toBeInstanceOf(THREE.DataTexture);expect(plain.material.map).toBeNull();
 const texture=painted.material.map as THREE.DataTexture,bytes=(texture.image.data as Uint8Array).slice();
 const disposeTexture=vi.spyOn(texture,"dispose");
 art.update([pulse("three",nebula)]);
 expect((find("-"+nebula).material.map as THREE.DataTexture).image.data).not.toEqual(bytes);
 expect(texture.image.data).toEqual(bytes);expect(painted.visible).toBe(false);
 art.update([pulse("one",solar)]);expect(find("-"+solar)).toBe(painted);
 art.dispose();art.dispose();expect(disposeTexture).toHaveBeenCalledTimes(1);
});
