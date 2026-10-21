import * as THREE from "three";
import { SHOP_CATALOG, type PrSnapshotPlayer } from "@planetfall/shared";
import type { AstronautVisual } from "../../astronaut";
import { cosmeticTrailStyle } from "../../cosmetic-flight-trail";
import { applyCosmeticEmotePose, applyCosmeticVictoryPose } from "../../cosmetic-pose";

/** Call after canonical locomotion. Never changes root position, yaw, or authoritative state. */
export function createPrPilotPresentation(rig:AstronautVisual,scene:THREE.Scene):{
  update(state:PrSnapshotPlayer,elapsedMs:number,dt:number):void;dispose():void;
} {
  const geometry=new THREE.OctahedronGeometry(1,0);
  const material=new THREE.MeshBasicMaterial({color:0x70f5ff,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});
  const trail=new THREE.InstancedMesh(geometry,material,8);
  trail.name="planet-run-cosmetic-trail";trail.frustumCulled=false;trail.visible=false;trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(trail);
  const positions=new Float32Array(24),ages=new Float32Array(8);ages.fill(1);
  const transform=new THREE.Object3D();
  let slot=0,clock=0,lean=0,lastSuit="",lastTrail="",width=.065,particle=0,dashed=false,disposed=false;
  let previousX=rig.group.position.x,previousY=rig.group.position.y,previousZ=rig.group.position.z;
  const torsoY=rig.torso.position.y;
  return {
    update(state,elapsedMs,dt){
      if(disposed)return;
      const step=THREE.MathUtils.clamp(dt,0,.05);
      const dx=rig.group.position.x-previousX,dy=rig.group.position.y-previousY,dz=rig.group.position.z-previousZ;
      if(dx*dx+dy*dy+dz*dz>100)ages.fill(1);
      previousX=rig.group.position.x;previousY=rig.group.position.y;previousZ=rig.group.position.z;
      const suitKey=state.equippedCosmetics.suit+state.color;
      if(suitKey!==lastSuit){lastSuit=suitKey;rig.suitMaterial.color.set(SHOP_CATALOG.find(i=>i.category==="suit"&&i.id===state.equippedCosmetics.suit)?.color??state.color);}
      if(lastTrail!==state.equippedCosmetics.trail){
        lastTrail=state.equippedCosmetics.trail;
        material.color.set(SHOP_CATALOG.find(i=>i.category==="trail"&&i.id===lastTrail)?.color??state.color);
        const style=cosmeticTrailStyle(lastTrail);width=style.width;particle=style.particles;dashed=style.dashed;
        ages.fill(1);
      }
      const speed=Math.hypot(state.velocity.x,state.velocity.z);
      // Hazard stagger also uses diveUntil. Only deliberate dive/boost has the longer cooldown gap.
      const diving=state.diveUntil>elapsedMs&&state.diveReadyAt-state.diveUntil>=500;
      const stagger=state.diveUntil>elapsedMs&&!diving;
      const target=diving?.42:stagger?-.12:0;
      lean+=(target-lean)*(1-Math.exp(-step*15));
      rig.upperBody.rotation.x+=lean;
      rig.torso.position.y=torsoY;
      if(diving){rig.leftArm.rotation.x=rig.rightArm.rotation.x=-1.35;rig.leftArm.rotation.z=.24;rig.rightArm.rotation.z=-.24;}
      if(state.emote&&elapsedMs-state.emoteStartedAt>=0&&elapsedMs-state.emoteStartedAt<1600&&state.grounded&&speed<1)applyCosmeticEmotePose(rig,state.emote,elapsedMs-state.emoteStartedAt);
      if(state.status==="qualified"){
        applyCosmeticEmotePose(rig,"celebrate",elapsedMs);
        const spin=applyCosmeticVictoryPose(rig,state.equippedCosmetics.victory,elapsedMs/1000);
        if(spin)rig.upperBody.rotation.y+=spin;
      }
      const emit=rig.group.visible&&state.status==="active"&&(diving||(!state.grounded&&speed>11));
      clock+=step;
      if(emit&&clock>=.045){
        clock=0;const k=slot*3;
        positions[k]=rig.group.position.x;positions[k+1]=rig.group.position.y+.8;positions[k+2]=rig.group.position.z;
        ages[slot]=0;slot=(slot+1)%8;
      }
      let visible=false;
      for(let i=0;i<8;i++){
        ages[i]+=step;const life=Math.max(0,1-ages[i]/.36),k=i*3;
        const size=life*(particle||width*2.2);
        transform.position.set(positions[k],positions[k+1],positions[k+2]);
        transform.scale.set(size,size*(dashed?1.6:1),size);
        transform.rotation.set(0,elapsedMs*.002+i,i*.7);transform.updateMatrix();trail.setMatrixAt(i,transform.matrix);
        if(life>0)visible=true;
      }
      trail.visible=visible&&rig.group.visible;trail.instanceMatrix.needsUpdate=true;
    },
    dispose(){if(disposed)return;disposed=true;trail.removeFromParent();trail.dispose();geometry.dispose();material.dispose();},
  };
}
