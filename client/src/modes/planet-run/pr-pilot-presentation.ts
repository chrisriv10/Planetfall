import {applyPrDivePose} from "./pr-dive-pose";
import {applyAstronautSuitFinish} from "../../astronaut-suit-finish";
import * as THREE from "three";
import { SHOP_CATALOG, type PrSnapshotPlayer } from "@planetfall/shared";
import type { AstronautVisual } from "../../astronaut";
import {createPrTrailArt} from "./pr-trail-art";
import { applyCosmeticEmotePose, applyCosmeticVictoryPose } from "../../cosmetic-pose";

export interface PrPilotPresentationContext {
  readonly lowGravity?:boolean;
  readonly boosted?:boolean;
  readonly detail?:"near"|"far";
}

/** Call after restoring root heading and canonical locomotion each frame.
 * Dive pitch is visual-only; position, scale and authoritative state remain untouched. */
export function createPrPilotPresentation(rig:AstronautVisual,scene:THREE.Scene):{
  update(state:PrSnapshotPlayer,elapsedMs:number,dt:number,context?:PrPilotPresentationContext):void;dispose():void;
} {
  const trailArt=createPrTrailArt(scene);
  let lean=0,diveBlend=0,lastSuit="",disposed=false;
  let previousGrounded=true,previousVy=0,impact=0,lastStatus:PrSnapshotPlayer["status"]="active",statusAt=0;
  const torsoY=rig.torso.position.y,torsoScale=rig.torso.scale.clone();
  return {
    update(state,elapsedMs,dt,context){
      if(disposed)return;
      const step=THREE.MathUtils.clamp(dt,0,.05);
      const suitKey=state.equippedCosmetics.suit+state.color;
      if(suitKey!==lastSuit){lastSuit=suitKey;const item=SHOP_CATALOG.find(i=>i.category==="suit"&&i.id===state.equippedCosmetics.suit);rig.suitMaterial.color.set(item?.color??state.color);applyAstronautSuitFinish(rig,item?.suitStyle??null);}
      const speed=Math.hypot(state.velocity.x,state.velocity.z);
      // Hazard stagger also uses diveUntil. Only deliberate dive/boost has the longer cooldown gap.
      const diving=state.status==="active"&&state.diveUntil>elapsedMs&&state.diveReadyAt-state.diveUntil>=500;
      const stagger=state.diveUntil>elapsedMs&&!diving;
      const near=context?.detail!=="far",boosted=context?.boosted===true,lowGravity=context?.lowGravity===true&&!state.grounded;
      if(lastStatus!==state.status){lastStatus=state.status;statusAt=elapsedMs;}
      const statusAge=Math.max(0,elapsedMs-statusAt);
      if(state.grounded&&!previousGrounded&&previousVy<-3)impact=Math.min(.12,-previousVy*.008);
      previousGrounded=state.grounded;previousVy=state.velocity.y;impact*=Math.exp(-step*16);
      const target=stagger?-.18:boosted&&!diving?.2:lowGravity&&!diving?-.08:0;
      diveBlend+=((diving?1:0)-diveBlend)*(1-Math.exp(-step*(diving?24:14)));
      lean+=(target-lean)*(1-Math.exp(-step*15));
      rig.upperBody.rotation.x+=lean;
      rig.torso.position.y=torsoY;
      rig.torso.scale.copy(torsoScale);
      if(near){
        // Subtle mesh-only stretch; canonical skeleton, root and support remain untouched.
        const stretch=!state.grounded&&!diving?Math.min(.065,Math.abs(state.velocity.y)*.004)+(lowGravity?.025:0):-impact*.3;
        rig.torso.scale.set(torsoScale.x*(1-stretch*.35),torsoScale.y*(1+stretch),torsoScale.z*(1-stretch*.2));
        rig.torso.position.y-=impact;
        if(lowGravity&&!diving){rig.leftArm.rotation.z=.4;rig.rightArm.rotation.z=-.4;rig.leftArm.rotation.x=rig.rightArm.rotation.x=-.3;}
        if(boosted&&!diving){rig.leftArm.rotation.x=rig.rightArm.rotation.x=.55;rig.leftArm.rotation.z=.18;rig.rightArm.rotation.z=-.18;}
        if(stagger){rig.leftArm.rotation.z=.65;rig.rightArm.rotation.z=-.65;}
      }
      if(state.status==="active"&&diveBlend>.001)applyPrDivePose(rig,diveBlend);
      if(near&&state.emote&&elapsedMs-state.emoteStartedAt>=0&&elapsedMs-state.emoteStartedAt<1600&&state.grounded&&speed<1)applyCosmeticEmotePose(rig,state.emote,elapsedMs-state.emoteStartedAt);
      if(state.status==="qualified"){
        applyCosmeticEmotePose(rig,"celebrate",near?statusAge:0);
        const spin=applyCosmeticVictoryPose(rig,state.equippedCosmetics.victory,near?statusAge/1000:0);
        if(spin)rig.upperBody.rotation.y+=spin;
      }
      if(state.status==="eliminated"&&near){rig.leftArm.rotation.x=rig.rightArm.rotation.x=-1.1;rig.leftArm.rotation.z=.85;rig.rightArm.rotation.z=-.85;rig.upperBody.rotation.z+=Math.sin(statusAge*.008)*.09;}
      // Far pilots retain readable poses but spend no matrix/upload work on trailing specks.
      if(!near){trailArt.update(rig.group.position,state.equippedCosmetics.trail,state.color,step,false,false,.045);return;}
      const celebrating=state.status==="qualified"&&statusAge<500;
      const fallingOut=state.status==="eliminated"&&statusAge<450;
      const emit=rig.group.visible&&(celebrating||fallingOut||state.status==="active"&&(diving||boosted&&speed>1||lowGravity&&(speed>2||Math.abs(state.velocity.y)>1)||!state.grounded&&speed>11));
      trailArt.update(rig.group.position,state.equippedCosmetics.trail,state.color,step,rig.group.visible,emit,boosted||celebrating?.03:lowGravity?.065:.045,celebrating);
    },
    dispose(){if(disposed)return;disposed=true;rig.torso.scale.copy(torsoScale);rig.torso.position.y=torsoY;trailArt.dispose();},
  };
}
