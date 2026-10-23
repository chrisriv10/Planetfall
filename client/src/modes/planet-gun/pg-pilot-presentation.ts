import * as THREE from "three";
import {PG_WEAPONS,type BrWeaponId,type PgSnapshotPlayer,type PgWeaponId} from "@planetfall/shared";
import type {AstronautVisual} from "../../astronaut";
import {BrWeaponModelLibrary} from "../battle-royale/br-weapon-model-library";

const MODELS:Record<PgWeaponId,BrWeaponId>={pulse:"pulse-rifle",nova:"nova-smg",photon:"photon-shotgun",quasar:"quasar-carbine",rail:"rail-laser",comet:"comet-hand-cannon"};
let library:BrWeaponModelLibrary|null=null,users=0;
/** Call after canonical astronaut motion updates. A separate pose layer keeps
 * these restrained mode accents from accumulating in canonical animation. */
export function createPgPilotPresentation(rig:AstronautVisual){
  if(!library)library=new BrWeaponModelLibrary();users++;
  const weaponLibrary=library,root=new THREE.Group(),glove=new THREE.Vector3();
  const upperParent=rig.upperBody.parent??rig.group,posture=new THREE.Group();
  posture.name="planet-gun-pilot-posture";upperParent.add(posture);posture.add(rig.upperBody);
  root.name="planet-gun-held-weapon";root.rotation.order="YXZ";rig.upperBody.add(root);
  const models=new Map<PgWeaponId,THREE.Group>();let current:PgWeaponId|null=null,disposed=false;
  return {
    update(state:PgSnapshotPlayer,time:number):void{
      if(disposed)return;
      const gun=state.guns[state.slot];
      if(current!==gun.id){
        let model=models.get(gun.id);
        if(!model){model=weaponLibrary.create(MODELS[gun.id],0x8ee8d9);model.scale.setScalar(.48);model.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});root.add(model);models.set(gun.id,model);}
        for(const [id,item]of models)item.visible=id===gun.id;current=gun.id;
      }
      root.visible=state.hp>0;
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
        if(state.adsSince>0){posture.rotation.x+=.035;posture.position.z+=.025;}
      }
      rig.rightArm.updateMatrix();glove.set(0,-.61,0).applyMatrix4(rig.rightArm.matrix);
      const reload=gun.reloadUntil>time?Math.sin(Math.PI*Math.max(0,Math.min(1,1-(gun.reloadUntil-time)/PG_WEAPONS[gun.id].reloadMs))):0;
      const recoil=state.hp>0?Math.min(.045,Math.max(0,gun.recoil||0)):0;
      root.position.copy(glove);root.position.y+=.13-reload*.05;root.position.z-=.12+recoil*.35;
      root.rotation.set(Math.max(-1.2,Math.min(1.2,state.pitch))*.65+reload*.3+recoil,Math.PI,0,"YXZ");
    },
    dispose():void{if(disposed)return;disposed=true;root.removeFromParent();root.clear();upperParent.add(rig.upperBody);posture.removeFromParent();models.clear();users--;if(users===0){weaponLibrary.dispose();library=null;}}
  };
}
