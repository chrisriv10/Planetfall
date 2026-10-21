import * as THREE from "three";
import type { AstronautVisual } from "./astronaut";
import { createAstronautArmIk } from "./astronaut-arm-ik";

/** Supported held-weapon articulation: callers reset BEFORE locomotion/actions each frame,
 * then apply only for supported near-detail carry/ADS after action overrides.
 * Owns two subdivided sleeve geometries and skeletons; all materials and original rig parts are borrowed. */
export const SUPPORTED_ARM_MIN_PITCH=-1.25;
export const SUPPORTED_ARM_MAX_PITCH=1.05;
export const SUPPORTED_ARM_MAX_YAW=.4;
export function createAstronautSupportedArms(rig:Pick<AstronautVisual,"leftArm"|"rightArm"|"group"|"upperBody">){
  const down=new THREE.Vector3(0,-1,0),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
  const solve=createAstronautArmIk(),upperQ=new THREE.Quaternion(),foreQ=new THREE.Quaternion(),direction=new THREE.Vector3();
  const arms=[rig.leftArm,rig.rightArm].map((arm,index)=>{
    const sleeve=arm.children[1] as THREE.Mesh,cuff=arm.children[2],glove=arm.children[3];
    const geometry=subdivideSleeve(sleeve.geometry,sleeve.position.y);
    const position=geometry.getAttribute("position"),indices=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
    for(let i=0;i<position.count;i++){
      const y=-position.getY(i); const before=y<=.305;
      const blend=THREE.MathUtils.clamp(before?(y-.165)/.14:(y-.305)/.14,0,1);
      indices[i*4]=before?0:2; indices[i*4+1]=before?2:1;
      weights[i*4]=1-blend;weights[i*4+1]=blend;
    }
    geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
    const upper=new THREE.Bone(),fore=new THREE.Bone();fore.position.y=-.305;upper.add(fore); const middle=new THREE.Bone(); middle.position.y=-.305; upper.add(middle);
    const skin=new THREE.SkinnedMesh(geometry,sleeve.material);skin.name="articulated-arm-sleeve";skin.castShadow=sleeve.castShadow;skin.frustumCulled=false;skin.add(upper);
    arm.add(skin);skin.bind(new THREE.Skeleton([upper,fore,middle]));skin.visible=false;
    const side=index===0?-1:1;
    return {solvedUpper:new THREE.Quaternion(),solvedFore:new THREE.Quaternion(),pad:arm.children[0],padPosition:arm.children[0].position.clone(),arm,sleeve,cuff,glove,skin,upper,fore,middle,side,bindPosition:arm.position.clone(),priorQuaternion:arm.quaternion.clone(),cuffPosition:cuff.position.clone(),glovePosition:glove.position.clone(),cuffQuaternion:cuff.quaternion.clone(),gloveQuaternion:glove.quaternion.clone(),target:new THREE.Vector3(side*.19,1.18,.68),shoulder:new THREE.Vector3(side*.52,1.02,.24),pole:new THREE.Vector3(side*1.52,1.32,.24)};
  });
  let active=false,disposed=false;
  const state={weight:0};
  const reset=()=>{
    if(!active)return;
    for(const a of arms){
      a.pad.position.copy(a.padPosition);a.arm.position.copy(a.bindPosition);a.arm.quaternion.copy(a.priorQuaternion);
      a.cuff.position.copy(a.cuffPosition);a.glove.position.copy(a.glovePosition);
      a.cuff.quaternion.copy(a.cuffQuaternion);a.glove.quaternion.copy(a.gloveQuaternion);
      a.sleeve.visible=true;a.skin.visible=false;
    }
    active=false;
  };
  const pose=(enabled:boolean,weight:number,pitch=0,yaw=0,recoil=0,leftTarget?:THREE.Vector3,rightTarget?:THREE.Vector3)=>{
    if(disposed)return false;
    if(!enabled){reset();return false;}
    if(!Number.isFinite(recoil)||recoil<0||recoil>1||!Number.isFinite(yaw)||Math.abs(yaw)>SUPPORTED_ARM_MAX_YAW||!Number.isFinite(pitch)||pitch< SUPPORTED_ARM_MIN_PITCH||pitch>SUPPORTED_ARM_MAX_PITCH)return false;
    // Pitch around a wrist-level horizontal hinge, with a small forward reach
    // on upward aim so the unchanged gloves stay ahead of the helmet facets.
    const aimY=1.155+.025*Math.cos(pitch);
    const verticalPhase=THREE.MathUtils.clamp((-pitch-1.2)/(Math.PI/2-1.2),0,1); const aimZ=.68+.025*Math.sin(pitch)+.025*Math.abs(Math.sin(pitch))+.03*verticalPhase*verticalPhase*(3-2*verticalPhase);
    for(const a of arms){
      a.shoulder.x=a.side*(.52-.06*Math.abs(yaw)/.4); a.shoulder.z=.28+.09*Math.abs(yaw)/.4; a.pole.z=a.shoulder.z; const downPhase=THREE.MathUtils.clamp((pitch-.85)/(Math.PI/2-.85),0,1); a.pole.y=1.32+1.0*downPhase*downPhase*(3-2*downPhase); a.target.set(a.side*.19*Math.cos(yaw)-.02*recoil*Math.cos(pitch)*Math.sin(yaw),aimY+.02*recoil*Math.sin(pitch),aimZ+.19*Math.abs(Math.sin(yaw))-a.side*.19*Math.sin(yaw)-.02*recoil*Math.cos(pitch));
      if(leftTarget&&rightTarget)a.target.copy(a.side<0?leftTarget:rightTarget); if(!solve(a.shoulder,a.target,a.pole,elbow,wrist))return false;
      upperQ.setFromUnitVectors(down,direction.subVectors(elbow,a.shoulder).normalize());
      foreQ.setFromUnitVectors(down,direction.subVectors(wrist,elbow).normalize());a.solvedUpper.copy(upperQ);a.solvedFore.copy(foreQ);
    }
    for(const a of arms){upperQ.copy(a.solvedUpper);foreQ.copy(a.solvedFore);
      if(!active)a.priorQuaternion.copy(a.arm.quaternion);
      // Resolve the old rigid carry's chest overlap first by reaching forward;
      // bend only after the shoulders have reached the proven clear position.
      const reach=Math.min(1,weight/.25),bend=Math.max(0,(weight-.25)/.75);
      const smoothReach=reach*reach*(3-2*reach),smoothBend=bend*bend*(3-2*bend);
      a.arm.position.lerpVectors(a.bindPosition,a.shoulder,smoothReach);
      a.arm.position.x=THREE.MathUtils.lerp(a.bindPosition.x,a.shoulder.x,smoothBend);
      // Clear the existing sprint cuff before folding inward, then settle
      // back to the proven shoulder anchor as the elbow finishes bending.
      a.arm.position.z=a.bindPosition.z+smoothReach*(a.shoulder.z-a.bindPosition.z+.06*(1-smoothBend)+.01*THREE.MathUtils.clamp((pitch-.85)/.2,0,1)*Math.sin(Math.PI*bend));
      a.arm.quaternion.identity();a.pad.position.copy(a.padPosition);a.pad.position.y-=.05;
      a.upper.quaternion.copy(a.priorQuaternion).slerp(upperQ,smoothBend);
      a.fore.quaternion.copy(upperQ).invert().multiply(foreQ);
      a.fore.quaternion.slerp(newIdentity,1-smoothBend); a.middle.quaternion.copy(newIdentity).slerp(a.fore.quaternion,.5);
      direction.set(0,-.305,0).applyQuaternion(a.upper.quaternion); foreQ.copy(a.upper.quaternion).multiply(a.fore.quaternion); a.cuff.position.set(0,-.175,0).applyQuaternion(foreQ).add(direction);a.glove.position.set(0,-.305,0).applyQuaternion(foreQ).add(direction);
      a.cuff.quaternion.copy(foreQ);a.glove.quaternion.copy(foreQ);a.sleeve.visible=false;a.skin.visible=true;
    }
    active=true;
    return true;
  };
  const newIdentity=new THREE.Quaternion();
  const apply=(enabled:boolean,pitch=0,yaw=0)=>pose(enabled,1,pitch,yaw);
  return {
    reset,apply,state,
    /** Explicit action targets suppress firing recoil. Angles describe the shoulder frame. */
    applyTargets(left:THREE.Vector3,right:THREE.Vector3,pitch=0,yaw=0){
      if(!Number.isFinite(left.x)||!Number.isFinite(left.y)||!Number.isFinite(left.z)||!Number.isFinite(right.x)||!Number.isFinite(right.y)||!Number.isFinite(right.z))return false;
      return pose(true,1,pitch,yaw,0,left,right);
    },
    /** Reset before motion each frame, then update after actions. Weight survives
     * reset. hardReset yields immediately for special modes or distant LOD. */
    update(enabled:boolean,dt:number,hardReset=false,pitch=0,yaw=0,recoil=0){
      if(disposed)return false;
      if(hardReset){state.weight=0;reset();return false;}
      const delta=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
      const nextWeight=THREE.MathUtils.clamp(state.weight+(enabled?delta/.18:-delta/.12),0,1); const accepted=pose(nextWeight>0,nextWeight,pitch,yaw,recoil); if(accepted||nextWeight===0)state.weight=nextWeight; return accepted;
    },
    /** Writes an actual glove center in upperBody coordinates into cached output. */
    wrist(side:"left"|"right",out:THREE.Vector3){const a=arms[side==="left"?0:1];a.glove.getWorldPosition(out);return rig.upperBody.worldToLocal(out);},
    dispose(){if(disposed)return;reset();for(const a of arms){a.skin.removeFromParent();a.skin.skeleton.dispose();a.skin.geometry.dispose();}disposed=true;}
  };
}







/** Insert elbow blend rings on the original triangle planes. No bind-surface
 * vertex moves; only construction-time topology changes. */
function subdivideSleeve(source:THREE.BufferGeometry,offsetY:number):THREE.BufferGeometry {
  type Vertex={p:THREE.Vector3;n:THREE.Vector3;uv:THREE.Vector2};
  const position=source.getAttribute("position"),normal=source.getAttribute("normal"),uv=source.getAttribute("uv"),index=source.index;
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[];
  const interpolate=(a:Vertex,b:Vertex,t:number):Vertex=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
  for(let i=0;i<(index?.count??position.count);i+=3){
    let polygons:Vertex[][]=[Array.from({length:3},(_,j)=>{
      const k=index?index.getX(i+j):i+j;
      const p=new THREE.Vector3().fromBufferAttribute(position,k);p.y+=offsetY;
      return{p,n:new THREE.Vector3().fromBufferAttribute(normal,k),uv:new THREE.Vector2(uv.getX(k),uv.getY(k))};
    })];
    for(const height of [-.165,-.2,-.235,-.27,-.305,-.34,-.375,-.41,-.445]){
      const next:Vertex[][]=[];
      for(const polygon of polygons){
        const below:Vertex[]=[],above:Vertex[]=[];
        for(let k=0;k<polygon.length;k++){
          const a=polygon[k],b=polygon[(k+1)%polygon.length],da=a.p.y-height,db=b.p.y-height;
          if(da<=0)below.push(a);if(da>=0)above.push(a);
          if(da*db<0){const v=interpolate(a,b,da/(da-db));below.push(v);above.push(v);}
        }
        if(below.length>=3)next.push(below);if(above.length>=3)next.push(above);
      }
      polygons=next;
    }
    for(const polygon of polygons)for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
      positions.push(v.p.x,v.p.y,v.p.z);normals.push(v.n.x,v.n.y,v.n.z);uvs.push(v.uv.x,v.uv.y);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  return geometry;
}
