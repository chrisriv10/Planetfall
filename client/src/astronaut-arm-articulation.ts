import * as THREE from "three";
import type { AstronautVisual } from "./astronaut";
import { createAstronautArmIk } from "./astronaut-arm-ik";

/** Experimental adapter: callers reset BEFORE locomotion/actions each frame,
 * then apply only for supported near-detail carry/ADS after action overrides.
 * Owns two sleeve geometry clones; all materials and original rig parts borrowed. */
export function createAstronautArmArticulation(rig:Pick<AstronautVisual,"leftArm"|"rightArm"|"group"|"upperBody">){
  const down=new THREE.Vector3(0,-1,0),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
  const solve=createAstronautArmIk(),upperQ=new THREE.Quaternion(),foreQ=new THREE.Quaternion(),direction=new THREE.Vector3();
  const arms=[rig.leftArm,rig.rightArm].map((arm,index)=>{
    const sleeve=arm.children[1] as THREE.Mesh,cuff=arm.children[2],glove=arm.children[3];
    const geometry=sleeve.geometry.clone();geometry.translate(0,sleeve.position.y,0);
    const position=geometry.getAttribute("position"),indices=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
    for(let i=0;i<position.count;i++){
      const blend=THREE.MathUtils.clamp((-position.getY(i)-.265)/.08,0,1);
      indices[i*4+1]=1;weights[i*4]=1-blend;weights[i*4+1]=blend;
    }
    geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
    const upper=new THREE.Bone(),fore=new THREE.Bone();fore.position.y=-.305;upper.add(fore);
    const skin=new THREE.SkinnedMesh(geometry,sleeve.material);skin.name="articulated-arm-sleeve";skin.castShadow=sleeve.castShadow;skin.frustumCulled=false;skin.add(upper);
    arm.add(skin);skin.bind(new THREE.Skeleton([upper,fore]));skin.visible=false;
    const side=index===0?-1:1;
    return {arm,sleeve,cuff,glove,skin,upper,fore,side,bindPosition:arm.position.clone(),priorQuaternion:arm.quaternion.clone(),cuffPosition:cuff.position.clone(),glovePosition:glove.position.clone(),cuffQuaternion:cuff.quaternion.clone(),gloveQuaternion:glove.quaternion.clone(),target:new THREE.Vector3(side*.19,1.18,.68),shoulder:new THREE.Vector3(side*.52,1.02,.24),pole:new THREE.Vector3(side*1.52,1.02,.24)};
  });
  let active=false,disposed=false;
  const state={weight:0};
  const reset=()=>{
    if(!active)return;
    for(const a of arms){
      a.arm.position.copy(a.bindPosition);a.arm.quaternion.copy(a.priorQuaternion);a.skin.removeFromParent();a.arm.add(a.cuff,a.glove,a.skin);
      a.cuff.position.copy(a.cuffPosition);a.glove.position.copy(a.glovePosition);
      a.cuff.quaternion.copy(a.cuffQuaternion);a.glove.quaternion.copy(a.gloveQuaternion);
      a.sleeve.visible=true;a.skin.visible=false;
    }
    active=false;
  };
  const pose=(enabled:boolean,weight:number,pitch=0)=>{
    if(disposed)return false;
    if(!enabled){reset();return false;}
    if(!Number.isFinite(pitch)||pitch< -1.15||pitch>.8){reset();return false;}
    // Pitch around a wrist-level horizontal hinge, with a small forward reach
    // on upward aim so the unchanged gloves stay ahead of the helmet facets.
    const aimY=1.155+.025*Math.cos(pitch);
    const aimZ=.68+.025*Math.sin(pitch)+.025*Math.abs(Math.sin(pitch));
    for(const a of arms){
      a.target.set(a.side*.19,aimY,aimZ);
      if(!solve(a.shoulder,a.target,a.pole,elbow,wrist)){reset();return false;}
      upperQ.setFromUnitVectors(down,direction.subVectors(elbow,a.shoulder).normalize());
      foreQ.setFromUnitVectors(down,direction.subVectors(wrist,elbow).normalize());
      if(!active)a.priorQuaternion.copy(a.arm.quaternion);
      // Resolve the old rigid carry's chest overlap first by reaching forward;
      // bend only after the shoulders have reached the proven clear position.
      const reach=Math.min(1,weight/.25),bend=Math.max(0,(weight-.25)/.75);
      const smoothReach=reach*reach*(3-2*reach),smoothBend=bend*bend*(3-2*bend);
      a.arm.position.lerpVectors(a.bindPosition,a.shoulder,smoothReach);
      a.arm.position.x=THREE.MathUtils.lerp(a.bindPosition.x,a.shoulder.x,smoothBend);
      // Clear the existing sprint cuff before folding inward, then settle
      // back to the proven shoulder anchor as the elbow finishes bending.
      a.arm.position.z=a.bindPosition.z+smoothReach*(a.shoulder.z-a.bindPosition.z+.04*(1-smoothBend));
      a.arm.quaternion.identity();
      a.upper.quaternion.copy(a.priorQuaternion).slerp(upperQ,smoothBend);
      a.fore.quaternion.copy(upperQ).invert().multiply(foreQ);
      a.fore.quaternion.slerp(newIdentity,1-smoothBend);
      a.fore.add(a.cuff,a.glove);a.cuff.position.set(0,-.175,0);a.glove.position.set(0,-.305,0);
      a.cuff.quaternion.identity();a.glove.quaternion.identity();a.sleeve.visible=false;a.skin.visible=true;
    }
    active=true;rig.group.updateMatrixWorld(true);
    return true;
  };
  const newIdentity=new THREE.Quaternion();
  const apply=(enabled:boolean,pitch=0)=>pose(enabled,1,pitch);
  return {
    reset,apply,state,
    /** Reset before motion each frame, then update after actions. Weight survives
     * reset. hardReset yields immediately for special modes or distant LOD. */
    update(enabled:boolean,dt:number,hardReset=false,pitch=0){
      if(disposed)return false;
      if(hardReset){state.weight=0;reset();return false;}
      const delta=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
      state.weight=THREE.MathUtils.clamp(state.weight+(enabled?delta/.18:-delta/.12),0,1);
      return pose(state.weight>0,state.weight,pitch);
    },
    /** Writes an actual glove center in upperBody coordinates into cached output. */
    wrist(side:"left"|"right",out:THREE.Vector3){const a=arms[side==="left"?0:1];a.glove.getWorldPosition(out);return rig.upperBody.worldToLocal(out);},
    dispose(){if(disposed)return;reset();for(const a of arms){a.skin.removeFromParent();a.skin.skeleton.dispose();a.skin.geometry.dispose();}disposed=true;}
  };
}
