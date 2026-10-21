import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildBrWeaponModel } from "./br-weapons";
import { createBrHeldWeaponSupport, isBrSupportWeaponId } from "./br-held-weapon-support";
import { createBrHeldReloadBrace, createBrHeldReloadPath } from "./br-held-reload";
it.each(["helix-burst-rifle","quasar-carbine","prism-beam","vortex-cannon"] as const)("restores borrowed %s resources and rejects invalid input without mutation",id=>{
 const model=new THREE.Group();buildBrWeaponModel(model,id,0xffffff);const original=model.children.slice(),bind=original.map(p=>({p,position:p.position.clone(),scale:p.scale.clone(),visible:p.visible}));
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),cylinder=new THREE.CylinderGeometry(1,1,1,8);
 const borrowed=[vi.spyOn(geometry,"dispose"),vi.spyOn(material,"dispose"),vi.spyOn(cylinder,"dispose")];
 const support=createBrHeldWeaponSupport(model,id,geometry,material,{cylinder});const brace=createBrHeldReloadBrace(model),path=createBrHeldReloadPath(id),wrapper=new THREE.Group();wrapper.add(model);
 const right=new THREE.Vector3(.19,1.18,.68);expect(support.update(wrapper,right,1,0,0)).toBe(true);
 const before=wrapper.matrix.clone();wrapper.updateMatrix();before.copy(wrapper.matrix);
 expect(support.update(wrapper,new THREE.Vector3(NaN,0,0),1)).toBe(false);wrapper.updateMatrix();expect(wrapper.matrix).toEqual(before);
 expect(path.update(.5,right,0,0)).toBe(true);const previous=path.state.left.clone();expect(path.update(.5,new THREE.Vector3(Infinity,0,0),0,0)).toBe(false);expect(path.state.left).toEqual(previous);
 expect(brace.update(.5)).toBe(true);brace.dispose();brace.dispose();expect(brace.update(.5)).toBe(false);
 support.restore();support.restore();expect(model.children).toEqual(original);for(const b of bind){expect(b.p.position).toEqual(b.position);expect(b.p.scale).toEqual(b.scale);expect(b.p.visible).toBe(b.visible);}borrowed.forEach(s=>expect(s).not.toHaveBeenCalled());
 geometry.dispose();material.dispose();cylinder.dispose();expect(isBrSupportWeaponId(id)).toBe(true);expect(isBrSupportWeaponId("comet-hand-cannon")).toBe(false);
});
