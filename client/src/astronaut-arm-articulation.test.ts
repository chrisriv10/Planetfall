import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {createAstronautVisual} from "./astronaut";
import {createAstronautArmArticulation} from "./astronaut-arm-articulation";
import {addBrWeaponSupportGrip,anchorBrSupportedWeapon,type BrSupportWeaponId} from "./modes/battle-royale/br-weapon-support-grip";
it("preserves bind parts, uses fixed arm segments and resets exactly",()=>{
 const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});
 const original=rig.leftArm.children.slice(),positions=original.map(p=>p.position.clone()),q=rig.leftArm.quaternion.clone();
 const controller=createAstronautArmArticulation(rig),left=new THREE.Vector3(),right=new THREE.Vector3();
 expect(controller.apply(true)).toBe(true);controller.wrist("left",left);controller.wrist("right",right);
 expect(left.distanceTo(new THREE.Vector3(-.19,1.18,.68))).toBeLessThan(1e-8);
 expect(right.distanceTo(new THREE.Vector3(.19,1.18,.68))).toBeLessThan(1e-8);
 expect(left.distanceTo(right)).toBeCloseTo(.38);
 for(const arm of [rig.leftArm,rig.rightArm]){
  const skin=arm.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;
  const [upper,fore]=skin.skeleton.bones;
  const a=upper.getWorldPosition(new THREE.Vector3()),b=fore.getWorldPosition(new THREE.Vector3());
  expect(a.distanceTo(b)).toBeCloseTo(.305);expect(b.distanceTo(arm===rig.leftArm?left:right)).toBeCloseTo(.305);
 }
 controller.reset();expect(rig.leftArm.position.toArray()).toEqual([-.57,1.02,0]);expect(rig.leftArm.quaternion.toArray()).toEqual(q.toArray());
 original.forEach((part,i)=>{expect(part.parent).toBe(rig.leftArm);expect(part.position).toEqual(positions[i]);});
 controller.dispose();controller.dispose();
});
it("puts each borrowed lateral support grip at the left wrist with a forward muzzle",()=>{
 for(const id of ["helix-burst-rifle","quasar-carbine","prism-beam","vortex-cannon"] as BrSupportWeaponId[]){
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
  addBrWeaponSupportGrip(group,id,geometry,material);anchorBrSupportedWeapon(group,id,new THREE.Vector3(.19,1.18,.68));group.updateMatrixWorld(true);
  expect(group.getObjectByName("weapon-support-grip")!.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-.19,1.18,.68))).toBeLessThan(1e-8);
  expect(new THREE.Vector3(0,0,-1).applyQuaternion(group.quaternion).z).toBeCloseTo(1);
  geometry.dispose();material.dispose();
 }
});
it("preserves neutral sleeve vertices and clears chest with the posed cuffs",()=>{
 const rig=createAstronautVisual({identityColor:'#70f5ff',suitAccent:'#ffd84d',isBot:false});
 const original=[rig.leftArm.children[1],rig.rightArm.children[1]] as THREE.Mesh[];
 const controller=createAstronautArmArticulation(rig);rig.group.updateMatrixWorld(true);
 for(let side=0;side<2;side++){
  const arm=side===0?rig.leftArm:rig.rightArm,skin=arm.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;
  skin.skeleton.update();const p=skin.geometry.getAttribute("position"),old=original[side].geometry.getAttribute("position");
  for(let i=0;i<p.count;i++){
   const a=skin.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(p,i)).applyMatrix4(skin.matrixWorld);
   const b=new THREE.Vector3().fromBufferAttribute(old,i).applyMatrix4(original[side].matrixWorld);
   expect(a.distanceTo(b)).toBeLessThan(1e-6);
  }
 }
 controller.apply(true);
 const chest=new THREE.Box3(new THREE.Vector3(-.31,.64,.37),new THREE.Vector3(.31,1,.49));
 for(const arm of [rig.leftArm,rig.rightArm]){
  const skin=arm.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;
  const cuff=skin.skeleton.bones[1].children.find(p=>p instanceof THREE.Mesh&&(p.geometry instanceof THREE.CylinderGeometry))!;
  expect(chest.distanceToPoint(cuff.getWorldPosition(new THREE.Vector3()))).toBeGreaterThan(Math.hypot(.15,.07));
 }
 controller.dispose();
});
