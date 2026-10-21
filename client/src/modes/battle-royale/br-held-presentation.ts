import * as THREE from "three";
import type {AstronautVisual} from "../../astronaut";
import {createAstronautSupportedArms} from "../../astronaut-supported-arms";
import {createBrHeldWeaponSupport,type BrSupportWeaponId} from "./br-held-weapon-support";
import {createBrHeldReloadBrace,createBrHeldReloadPath} from "./br-held-reload";

export interface BrHeldPresentationFrame {
  dt:number;
  pitch:number;
  yaw:number;
  recoil:number;
  /** Normalized authoritative/predicted action progress; null after action exit. */
  reloadProgress:number|null;
}

/** One integration controller per held model. Call beforeMotion before ordinary
 * locomotion/action posing, then update after it. Dispose at a hidden/model-swap
 * boundary, before the model is released. No gameplay or shot state is written. */
export function createBrHeldPresentation(
  rig:Pick<AstronautVisual,"leftArm"|"rightArm"|"group"|"upperBody">,
  model:THREE.Group,id:BrSupportWeaponId,
  resources:{box:THREE.BoxGeometry;material:THREE.Material;cylinder:THREE.CylinderGeometry}
){
  const arms=createAstronautSupportedArms(rig);
  const support=createBrHeldWeaponSupport(model,id,resources.box,resources.material,{cylinder:resources.cylinder});
  const brace=createBrHeldReloadBrace(model),path=createBrHeldReloadPath(id),right=new THREE.Vector3();
  const state={valid:false,weight:0,reloadProgress:null as number|null,recovering:false};
  let disposed=false,lastReload:number|null=null;
  return {
    state,
    beforeMotion(){if(!disposed)arms.reset();},
    update(wrapper:THREE.Object3D,input:BrHeldPresentationFrame):boolean {
      state.valid=false;
      if(disposed||!Number.isFinite(input.dt)||input.dt<0||!Number.isFinite(input.recoil)||input.recoil<0||input.recoil>1
        ||input.reloadProgress!==null&&(!Number.isFinite(input.reloadProgress)||input.reloadProgress<0||input.reloadProgress>1))return false;
      const dt=Math.min(.05,input.dt);
      let progress=input.reloadProgress;
      // A visible interrupted action returns along its existing clear path.
      // Hidden/model-swap exits instead dispose the controller immediately.
      const recovering=progress===null&&lastReload!==null&&lastReload<1;
      if(recovering)progress=Math.min(1,lastReload!+dt/.12);
      if(!arms.update(true,dt,false,input.pitch,input.yaw,progress===null?input.recoil:0))return false;
      arms.wrist("right",right);
      let pitch=input.pitch,yaw=input.yaw,weight=arms.state.weight;
      if(progress!==null){
        if(!path.update(progress,right,pitch,yaw))return false;
        arms.reset();
        if(!arms.applyTargets(path.state.left,path.state.right,pitch,yaw))return false;
        arms.wrist("right",right);pitch=path.state.pitch;yaw=path.state.yaw;weight=1;
      }
      if(!support.update(wrapper,right,weight,pitch,yaw))return false;
      if(progress!==null){if(!brace.update(progress))return false;}else brace.restore();
      // Action targets already committed the fully supported pose. Continuing
      // an older equip blend afterward would reverse the attachment recovery.
      if(progress!==null)arms.state.weight=1;
      lastReload=progress!==null&&progress<1?progress:null;
      state.weight=weight;state.reloadProgress=progress;state.recovering=recovering;state.valid=true;
      return true;
    },
    dispose(){
      if(disposed)return;
      brace.dispose();support.restore();arms.dispose();disposed=true;
      state.valid=false;state.weight=0;state.reloadProgress=null;state.recovering=false;lastReload=null;
    }
  };
}
