import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createAstronautVisual } from "./astronaut";
import { createAstronautSupportedArms } from "./astronaut-supported-arms";
it("keeps both arms and blend unchanged on invalid input and restores borrowed parts exactly", () => {
 const rig=createAstronautVisual({identityColor:"#70f5ff",suitAccent:"#ffd84d",isBot:false});
 const limbs=[rig.leftArm,rig.rightArm];
 const bind=limbs.map(arm=>({position:arm.position.clone(),children:arm.children.slice(),transforms:arm.children.map(p=>({p,position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone(),visible:p.visible}))}));
 const arms=createAstronautSupportedArms(rig);
 const resources=limbs.flatMap(a=>{const skin=a.getObjectByName("articulated-arm-sleeve") as THREE.SkinnedMesh;expect(skin.skeleton.bones).toHaveLength(3);expect(skin.frustumCulled).toBe(false);return[vi.spyOn(skin.geometry,"dispose"),vi.spyOn(skin.skeleton,"dispose")];});
 expect(arms.apply(true,.5,.3)).toBe(true);arms.state.weight=1;
 const snapshot=()=>{const parts:number[][]=[];rig.group.traverse(p=>parts.push([...p.position.toArray(),...p.quaternion.toArray(),...p.scale.toArray()]));return parts;};
 const before=snapshot();
 for(const pitch of[NaN,Infinity,-1.251,1.051]){expect(arms.update(true,.05,false,pitch,0)).toBe(false);expect(arms.state.weight).toBe(1);expect(snapshot()).toEqual(before);}
 expect(arms.update(true,.05,false,0,0,NaN)).toBe(false);expect(snapshot()).toEqual(before);
 const left=arms.wrist("left",new THREE.Vector3()),right=arms.wrist("right",new THREE.Vector3());
 expect(arms.applyTargets(left,new THREE.Vector3(99,0,0))).toBe(false);expect(snapshot()).toEqual(before);
 expect(arms.applyTargets(left,right,.5,.3)).toBe(true);
 arms.reset();limbs.forEach((arm,i)=>{expect(arm.position).toEqual(bind[i].position);for(const b of bind[i].transforms){expect(b.p.parent).toBe(arm);expect(b.p.position).toEqual(b.position);expect(b.p.quaternion.toArray()).toEqual(b.quaternion.toArray());expect(b.p.scale).toEqual(b.scale);expect(b.p.visible).toBe(b.visible);}});
 arms.dispose();arms.dispose();resources.forEach(s=>expect(s).toHaveBeenCalledTimes(1));limbs.forEach((arm,i)=>expect(arm.children).toEqual(bind[i].children));
});
