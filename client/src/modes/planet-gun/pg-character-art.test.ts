import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {PG_HERO_IDS,PG_OPERATOR_IDS,pgResolveHero,pgResolveOperator} from "@planetfall/shared";
import {createAstronautVisual} from "../../astronaut";
import {createPgCharacterArt,createPgFirstPersonCharacterArt,pgCharacterPortraitSvg} from "./pg-character-art";

describe("PlanetGun character presentation",()=>{
 it("retains canonical front facets and eye instances for every identity",()=>{
  for(const id of [...PG_HERO_IDS,...PG_OPERATOR_IDS]){
   const rig=createAstronautVisual({identityColor:"#ffbf65",suitAccent:"#455f8a",isBot:false}),shell=rig.helmet.children[0] as THREE.Mesh,original=shell.geometry,eyes=rig.helmet.getObjectByName("astronaut-eyes") as THREE.InstancedMesh,eyeMatrices=Array.from(eyes.instanceMatrix.array),eyeGeometry=eyes.geometry;
   const art=createPgCharacterArt(rig,id),before=original.getAttribute("position"),after=shell.geometry.getAttribute("position"),beforeNormals=original.getAttribute("normal"),afterNormals=shell.geometry.getAttribute("normal");
   expect(Array.from(shell.geometry.index!.array)).toEqual(Array.from(original.index!.array));expect(after.count).toBe(before.count);
   let preserved=0;for(let i=0;i<before.count;i++)if(before.getZ(i)>.25&&Math.abs(before.getY(i))<=.31){preserved++;for(const axis of ["getX","getY","getZ"]as const){expect(after[axis](i),`${id} face position`).toBe(before[axis](i));expect(afterNormals[axis](i),`${id} face normal`).toBe(beforeNormals[axis](i));}}
   expect(preserved).toBeGreaterThan(8);expect(Array.from(eyes.instanceMatrix.array)).toEqual(eyeMatrices);expect(eyes.geometry).toBe(eyeGeometry);art.dispose();expect(shell.geometry).toBe(original);
  }
 });
 it("colors real armor surfaces, preserves team markings and restores materials and helmet geometry",()=>{
  for(const id of [...PG_HERO_IDS,...PG_OPERATOR_IDS]){
   const rig=createAstronautVisual({identityColor:"#ffbf65",suitAccent:"#455f8a",isBot:false}),original=new Map<THREE.Mesh,{material:THREE.Material|THREE.Material[];geometry:THREE.BufferGeometry}>();
   rig.group.traverse(o=>{if(o instanceof THREE.Mesh)original.set(o,{material:o.material,geometry:o.geometry});});
   const teamColor=rig.suitMaterial.color.getHex(),visor=rig.visor.material,art=createPgCharacterArt(rig,id),definition=(pgResolveHero(id)??pgResolveOperator(id))!;
   expect(rig.torso.material.color.getHexString()).toBe(new THREE.Color(definition.silhouette.colors.secondary).getHexString());
   const changed=[...original].filter(([mesh,state])=>mesh.material!==state.material);expect(changed.length).toBeGreaterThanOrEqual(10);
   expect(new Set(changed.map(([mesh])=>mesh.material)).size).toBeLessThanOrEqual(2);
   expect(rig.suitMaterial.color.getHex()).toBe(teamColor);expect(rig.visor.material).toBe(visor);
   for(const [mesh,state]of original)if(mesh instanceof THREE.InstancedMesh||state.material===rig.suitMaterial)expect(mesh.material).toBe(state.material);
   art.dispose();for(const [mesh,state]of original){expect(mesh.material).toBe(state.material);expect(mesh.geometry).toBe(state.geometry);}
  }
 });
 it("gives every character unique persistent geometry without changing the canonical rig",()=>{
  const signatures=new Set<string>();
  for(const id of [...PG_HERO_IDS,...PG_OPERATOR_IDS,"drifter","skitter","bulwark"]){
   const rig=createAstronautVisual({identityColor:"#ffbf65",suitAccent:"#455f8a",isBot:false}),original=rig.helmet.children.length,art=createPgCharacterArt(rig,id),parts:THREE.Mesh[]=[];
   rig.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.name===`pg-identity-${id}`)parts.push(o);});
   expect(parts.length).toBeGreaterThan(0);expect(parts.length).toBeLessThanOrEqual(12);
   signatures.add(JSON.stringify(parts.map(m=>Array.from(m.geometry.getAttribute("position").array))));
   for(const part of parts){expect(rig.lodDetails).not.toContain(part);part.geometry.computeBoundingBox();expect(part.geometry.boundingBox!.max.length()).toBeLessThan(2);}
   expect(rig.group.scale.toArray()).toEqual([1,1,1]);const dispose=vi.spyOn(parts[0].geometry,"dispose");art.dispose();art.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(rig.helmet.children.length).toBe(original);
  }expect(signatures.size).toBe(21);
 });
 it("projects cached portraits from actual geometry and rejects untrusted IDs",()=>{
  const a=pgCharacterPortraitSvg("cairn"),b=pgCharacterPortraitSvg("kepler");expect(a).toContain("<path");expect(a).not.toEqual(b);expect(pgCharacterPortraitSvg("cairn")).toBe(a);expect(pgCharacterPortraitSvg('<script>')).toBe("");
 });
 it("attaches firstperson plates only to animated gloves and inherits their layer",()=>{
  const root=new THREE.Group(),hand=new THREE.Group();hand.name="support-glove";hand.layers.set(3);root.add(hand);const art=createPgFirstPersonCharacterArt(root,"solace");expect(hand.children.length).toBeGreaterThan(0);for(const o of hand.children){expect(o.layers.mask).toBe(hand.layers.mask);expect(o.position.length()).toBeLessThan(.07);}art.dispose();expect(hand.children).toHaveLength(0);
 });
});
