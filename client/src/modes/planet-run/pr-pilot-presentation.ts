import * as THREE from "three";
import { SHOP_CATALOG, type PrSnapshotPlayer } from "@planetfall/shared";
import type { AstronautVisual } from "../../astronaut";
import { cosmeticTrailStyle } from "../../cosmetic-flight-trail";
import { applyCosmeticEmotePose, applyCosmeticVictoryPose } from "../../cosmetic-pose";

export interface PrPilotPresentationContext {
  readonly lowGravity?:boolean;
  readonly boosted?:boolean;
  readonly detail?:"near"|"far";
}

/** Call after canonical locomotion. Never changes root position, yaw, or authoritative state. */
export function createPrPilotPresentation(rig:AstronautVisual,scene:THREE.Scene):{
  update(state:PrSnapshotPlayer,elapsedMs:number,dt:number,context?:PrPilotPresentationContext):void;dispose():void;
} {
  const geometry=new THREE.OctahedronGeometry(1,0);
  const material=new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});
  const trail=new THREE.InstancedMesh(geometry,material,8);
  trail.name="planet-run-cosmetic-trail";trail.frustumCulled=false;trail.visible=false;trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(trail);
  const positions=new Float32Array(24),ages=new Float32Array(8);ages.fill(1);
  const transform=new THREE.Object3D();
  let slot=0,clock=0,lean=0,lastSuit="",lastTrail="",lastTrailColor="",width=.065,particle=0,dashed=false,disposed=false;
  let previousGrounded=true,previousVy=0,impact=0,lastStatus:PrSnapshotPlayer["status"]="active",statusAt=0;
  let previousX=rig.group.position.x,previousY=rig.group.position.y,previousZ=rig.group.position.z;
  const torsoY=rig.torso.position.y,torsoScale=rig.torso.scale.clone();
  return {
    update(state,elapsedMs,dt,context){
      if(disposed)return;
      const step=THREE.MathUtils.clamp(dt,0,.05);
      const dx=rig.group.position.x-previousX,dy=rig.group.position.y-previousY,dz=rig.group.position.z-previousZ;
      if(dx*dx+dy*dy+dz*dz>100)ages.fill(1);
      previousX=rig.group.position.x;previousY=rig.group.position.y;previousZ=rig.group.position.z;
      const suitKey=state.equippedCosmetics.suit+state.color;
      if(suitKey!==lastSuit){lastSuit=suitKey;rig.suitMaterial.color.set(SHOP_CATALOG.find(i=>i.category==="suit"&&i.id===state.equippedCosmetics.suit)?.color??state.color);}
      if(lastTrail!==state.equippedCosmetics.trail||lastTrailColor!==state.color){
        lastTrail=state.equippedCosmetics.trail;
        lastTrailColor=state.color;
        material.color.set(SHOP_CATALOG.find(i=>i.category==="trail"&&i.id===lastTrail)?.color??state.color);
        const style=cosmeticTrailStyle(lastTrail);width=style.width;particle=style.particles;dashed=style.dashed;
        ages.fill(1);
      }
      const speed=Math.hypot(state.velocity.x,state.velocity.z);
      // Hazard stagger also uses diveUntil. Only deliberate dive/boost has the longer cooldown gap.
      const diving=state.diveUntil>elapsedMs&&state.diveReadyAt-state.diveUntil>=500;
      const stagger=state.diveUntil>elapsedMs&&!diving;
      const near=context?.detail!=="far",boosted=context?.boosted===true,lowGravity=context?.lowGravity===true&&!state.grounded;
      if(lastStatus!==state.status){lastStatus=state.status;statusAt=elapsedMs;}
      const statusAge=Math.max(0,elapsedMs-statusAt);
      if(state.grounded&&!previousGrounded&&previousVy<-3)impact=Math.min(.12,-previousVy*.008);
      previousGrounded=state.grounded;previousVy=state.velocity.y;impact*=Math.exp(-step*16);
      const target=diving?.42:stagger?-.18:boosted?.2:lowGravity?-.08:0;
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
      if(diving){rig.leftArm.rotation.x=rig.rightArm.rotation.x=-1.35;rig.leftArm.rotation.z=.24;rig.rightArm.rotation.z=-.24;}
      if(near&&state.emote&&elapsedMs-state.emoteStartedAt>=0&&elapsedMs-state.emoteStartedAt<1600&&state.grounded&&speed<1)applyCosmeticEmotePose(rig,state.emote,elapsedMs-state.emoteStartedAt);
      if(state.status==="qualified"){
        applyCosmeticEmotePose(rig,"celebrate",near?statusAge:0);
        const spin=applyCosmeticVictoryPose(rig,state.equippedCosmetics.victory,near?statusAge/1000:0);
        if(spin)rig.upperBody.rotation.y+=spin;
      }
      if(state.status==="eliminated"&&near){rig.leftArm.rotation.x=rig.rightArm.rotation.x=-1.1;rig.leftArm.rotation.z=.85;rig.rightArm.rotation.z=-.85;rig.upperBody.rotation.z+=Math.sin(statusAge*.008)*.09;}
      // Far pilots retain readable poses but spend no matrix/upload work on trailing specks.
      if(!near){trail.visible=false;ages.fill(1);clock=0;return;}
      const celebrating=state.status==="qualified"&&statusAge<500;
      const fallingOut=state.status==="eliminated"&&statusAge<450;
      const emit=rig.group.visible&&(celebrating||fallingOut||state.status==="active"&&(diving||boosted&&speed>1||lowGravity&&(speed>2||Math.abs(state.velocity.y)>1)||!state.grounded&&speed>11));
      clock+=step;
      if(emit&&clock>=(boosted||celebrating?.03:lowGravity?.065:.045)){
        clock=0;const k=slot*3;
        positions[k]=rig.group.position.x+(celebrating?Math.sin(slot*2.4)*.45:0);positions[k+1]=rig.group.position.y+.8+(celebrating?(slot%3)*.3:0);positions[k+2]=rig.group.position.z+(celebrating?Math.cos(slot*2.4)*.45:0);
        ages[slot]=0;slot=(slot+1)%8;
      }
      let visible=false;
      for(let i=0;i<8;i++){
        ages[i]+=step;const life=Math.max(0,1-ages[i]/.36),k=i*3;
        const size=life*(particle||width*2.2)*(boosted?1.5:lowGravity?1.2:celebrating?1.4:1);
        transform.position.set(positions[k],positions[k+1],positions[k+2]);
        transform.scale.set(size,size*(fallingOut?2.4:dashed?1.6:1),size);
        transform.rotation.set(0,elapsedMs*.002+i,i*.7);transform.updateMatrix();trail.setMatrixAt(i,transform.matrix);
        if(life>0)visible=true;
      }
      trail.visible=visible&&rig.group.visible;trail.instanceMatrix.needsUpdate=true;
    },
    dispose(){if(disposed)return;disposed=true;rig.torso.scale.copy(torsoScale);rig.torso.position.y=torsoY;trail.removeFromParent();trail.dispose();geometry.dispose();material.dispose();},
  };
}
