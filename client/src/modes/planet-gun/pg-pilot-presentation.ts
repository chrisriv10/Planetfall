import * as THREE from "three";
import {PG_LEAN,pgGunProfile,type PgModuleId,type PgSnapshotPlayer,type PgWeaponId} from "@planetfall/shared";
import type {AstronautVisual} from "../../astronaut";
import {createPgWorldWeaponMount} from "./pg-world-weapon-art";
/** Call after canonical astronaut motion updates. A separate pose layer keeps
 * these restrained mode accents from accumulating in canonical animation. */
export function createPgPilotPresentation(rig:AstronautVisual){
  const root=new THREE.Group(),glove=new THREE.Vector3();
  const upperParent=rig.upperBody.parent??rig.group,posture=new THREE.Group();
  posture.name="planet-gun-pilot-posture";upperParent.add(posture);posture.add(rig.upperBody);
  root.name="planet-gun-held-weapon";root.rotation.order="YXZ";rig.upperBody.add(root);
  const mount=createPgWorldWeaponMount(root);let disposed=false;
  function poseWeapon(weaponId:PgWeaponId,pitch:number,reload:number,recoil:number,visible:boolean,upgradeTier:0|1|2|3=0,finishId?:string,modules?:readonly PgModuleId[]):void{
      mount.set(weaponId,modules,finishId,upgradeTier);
      root.visible=visible;
      rig.rightArm.updateMatrix();glove.set(0,-.61,0).applyMatrix4(rig.rightArm.matrix);
      root.position.copy(glove);root.position.y+=.13-reload*.05;root.position.z-=.12+recoil*.35;
      root.rotation.set(Math.max(-1.2,Math.min(1.2,pitch))*.65+reload*.3+recoil,Math.PI,0,"YXZ");
  }
  return {
    /** Display-only composition for the character selector; no synthetic player state. */
    display(input:{weaponId:PgWeaponId;pitch?:number;reload?:number;recoil?:number;visible?:boolean;finishId?:string}):void{
      if(disposed)return;posture.position.set(0,0,0);posture.rotation.set(0,0,0);
      poseWeapon(input.weaponId,input.pitch??0,input.reload??0,input.recoil??0,input.visible??true,0,input.finishId);
    },
    update(state:PgSnapshotPlayer,time:number,presentation:{upgradeTier?:0|1|2|3;weaponInserted?:boolean}={}):void{
      if(disposed)return;
      const gun=state.guns[state.slot];
      posture.position.set(0,0,0);posture.rotation.set(0,0,0);
      if(state.hp<=0){
        const progress=Math.min(1,Math.max(0,(time-state.deadAt)/350)),ease=progress*progress*(3-2*progress);
        posture.rotation.set(ease*.28,0,ease*.95);posture.position.set(ease*.16,-ease*.24,0);
      }else{
        if(state.mode==="slide"){posture.rotation.x=.16;posture.position.set(0,-.08,.06);}
        else if(state.mode==="wall-run"){
          const yaw=state.yaw+Math.PI;
          const outward=state.wallNormal.x*Math.cos(yaw)-state.wallNormal.z*Math.sin(yaw);
          posture.rotation.z=-Math.max(-1,Math.min(1,outward))*.12;posture.rotation.x=.055;
        }else if(!state.grounded&&state.jumpHeld&&state.ion>0){posture.rotation.x=.075;posture.position.z=.025;}
        if(state.grounded && state.mode==="ground" && Number.isFinite(state.lean) && state.lean!==0){
          const lean=THREE.MathUtils.clamp(state.lean,-1,1);
          // The group faces yaw + PI. Roll around the leg-independent posture
          // origin, then supply only the remaining travel to the optical center.
          const roll=lean*PG_LEAN.roll, headHeight=rig.helmet.position.y;
          posture.rotation.z=roll;
          posture.position.x=-lean*PG_LEAN.distance/rig.group.scale.x + headHeight*Math.sin(roll);
          posture.position.y=-Math.abs(lean)*PG_LEAN.drop/rig.group.scale.y + headHeight*(1-Math.cos(roll));
        }
        if(state.adsSince>0){posture.rotation.x+=.035;posture.position.z+=.025;}
      }
      const reload=gun.reloadUntil>time?Math.sin(Math.PI*Math.max(0,Math.min(1,1-(gun.reloadUntil-time)/pgGunProfile(gun).reloadMs))):0;
      const recoil=state.hp>0?Math.min(.045,Math.max(0,gun.recoil||0)):0;
      poseWeapon(gun.id,state.pitch,reload,recoil,state.hp>0&&!presentation.weaponInserted,presentation.upgradeTier??0,state.equippedCosmetics?.["weapon-skin"],gun.modules);
    },
    dispose():void{if(disposed)return;disposed=true;mount.dispose();root.removeFromParent();upperParent.add(rig.upperBody);posture.removeFromParent();}
  };
}
